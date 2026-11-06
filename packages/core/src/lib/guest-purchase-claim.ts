import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@acme/core/lib/prisma";
import { validateTenantId } from "./tenancy";

// Internal-only business logic. NO public route, mail provider, or customer link
// based solely on email matching. The secret must only reach the checkout mailbox.
const CLAIM_TTL_MS = 10 * 60_000;
const USER_WINDOW_MS = 60 * 60_000;
const ORDER_COOLDOWN_MS = 10 * 60_000;
const MAX_CHALLENGES_PER_USER_HOUR = 3;
const settledStatuses = ["PAID", "FULFILLING", "FULFILLED"] as const;

export class GuestClaimError extends Error {
  constructor(public readonly status: 401 | 404, message: string) {
    super(message);
    this.name = "GuestClaimError";
  }
}

function verifiedUserId(userId: string | null | undefined): string {
  if (!userId || !/^[a-zA-Z0-9_-]{3,128}$/.test(userId)) {
    throw new GuestClaimError(401, "Authentication required");
  }
  return userId;
}

function validNow(now: Date): Date {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Invalid clock");
  return now;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isPossibleMailbox(email: string): boolean {
  return email.length <= 320 && /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(email);
}

async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let n = 0; n < 3; n++) {
    try { return await prisma.$transaction(fn, { isolationLevel: "Serializable", timeout: 10000 }); }
    catch (error) {
      if (n === 2 || (error as { code?: unknown })?.code !== "P2034") throw error;
    }
  }
  throw new Error("Guest claim transaction conflict");
}

/** Initiation requires a trusted session user ID and a TRUSTED server mailer.
 * A caller-provided email address is intentionally not accepted. The return
 * shape is identical for unknown orders and real challenges (no enumeration).
 * The raw secret is passed only to the trusted delivery callback.
 */
export async function requestGuestPurchaseClaim(args: {
  userId: string | null | undefined;
  storeId: string;
  orderId: string;
  deliver: (message: { to: string; code: string; expiresAt: Date }) => Promise<void>;
  now?: Date;
}): Promise<{ accepted: true }> {
  const requesterUserId = verifiedUserId(args.userId);
  const storeId = validateTenantId(args.storeId);
  const orderId = validateTenantId(args.orderId);
  const now = validNow(args.now ?? new Date());
  const code = randomBytes(32).toString("base64url");
  const tokenHash = sha256(code);
  const expiresAt = new Date(now.getTime() + CLAIM_TTL_MS);

  const challenge = await serializable(async tx => {
    // Limits are *database-backed* across application instances; callers still
    // need IP/device limits at the HTTP edge before this feature is exposed.
    const recentByRequester = await tx.guestPurchaseClaim.count({
      where: { requesterUserId, createdAt: { gte: new Date(now.getTime() - USER_WINDOW_MS) } },
    });
    if (recentByRequester >= MAX_CHALLENGES_PER_USER_HOUR) return null;
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId, status: { in: [...settledStatuses] },
        customer: { is: { userId: null } } },
      select: { id: true, organizationId: true, storeId: true, customerId: true,
        customer: { select: { email: true, userId: true } } },
    });
    if (!order?.customerId || !order.customer || order.customer.userId !== null ||
        !isPossibleMailbox(order.customer.email)) return null;
    const previous = await tx.guestPurchaseClaim.findFirst({
      where: { organizationId: order.organizationId, storeId, orderId,
        createdAt: { gte: new Date(now.getTime() - ORDER_COOLDOWN_MS) } },
      select: { id: true },
    });
    if (previous) return null;
    const created = await tx.guestPurchaseClaim.create({
      data: { organizationId: order.organizationId, storeId, orderId,
        customerId: order.customerId, requesterUserId, tokenHash, expiresAt },
      select: { id: true },
    });
    return { id: created.id, to: order.customer.email };
  });

  if (challenge) {
    try {
      await args.deliver({ to: challenge.to, code, expiresAt });
    } catch {
      // A delivery failure must invalidate the challenge, without leaking
      // its token or whether the supplied order exists to the client.
      await prisma.guestPurchaseClaim.updateMany({
        where: { id: challenge.id, consumedAt: null }, data: { consumedAt: now },
      });
    }
  }
  return { accepted: true };
}

/** One-time redemption, always scoped to the same signed-in requester.
 * Verified possession of the order's checkout mailbox links its organization-
 * scoped Customer row to this user. This deliberately includes all purchases
 * for that customer under the same organization, but no other merchant.
 */
export async function redeemGuestPurchaseClaim(args: {
  userId: string | null | undefined;
  code: string;
  /** Storefront scope is required by HTTP handlers. Internal callers can omit it. */
  storeId?: string;
  now?: Date;
}): Promise<{ claimed: true }> {
  const userId = verifiedUserId(args.userId);
  const expectedStoreId = args.storeId === undefined ? null : validateTenantId(args.storeId);
  if (typeof args.code !== "string" || !/^[a-zA-Z0-9_-]{43}$/.test(args.code)) {
    throw new GuestClaimError(404, "Invalid or expired claim");
  }
  const now = validNow(args.now ?? new Date());
  const tokenHash = sha256(args.code);
  return serializable(async tx => {
    const claim = await tx.guestPurchaseClaim.findUnique({
      where: { tokenHash }, select: { id: true, organizationId: true, storeId: true,
        orderId: true, customerId: true, requesterUserId: true,
        expiresAt: true, consumedAt: true },
    });
    if (!claim || claim.requesterUserId !== userId ||
        (expectedStoreId !== null && claim.storeId !== expectedStoreId) ||
        claim.consumedAt || claim.expiresAt <= now) {
      throw new GuestClaimError(404, "Invalid or expired claim");
    }
    const order = await tx.order.findFirst({
      where: { id: claim.orderId, organizationId: claim.organizationId,
        storeId: claim.storeId, customerId: claim.customerId,
        status: { in: [...settledStatuses] } },
      select: { id: true, customer: { select: { id: true, userId: true } } },
    });
    if (!order?.customer || (order.customer.userId !== null && order.customer.userId !== userId)) {
      throw new GuestClaimError(404, "Invalid or expired claim");
    }
    const claimed = await tx.guestPurchaseClaim.updateMany({
      where: { id: claim.id, requesterUserId: userId, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) throw new GuestClaimError(404, "Invalid or expired claim");
    if (order.customer.userId === null) {
      const linked = await tx.customer.updateMany({
        where: { id: claim.customerId, organizationId: claim.organizationId, userId: null },
        data: { userId },
      });
      if (linked.count !== 1) throw new GuestClaimError(404, "Invalid or expired claim");
    }
    return { claimed: true };
  });
}
