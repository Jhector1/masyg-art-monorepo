// src/helpers/stripe/webhook/entitlements.ts
import { prisma } from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
// (No need to import Prisma; we won't use Prisma.sql in filters.)

export type Who = { userId?: string | null; guestId?: string | null };

/**
 * Sum active entitlements for a user/guest on a product.
 * Returns exportQuota, exportsUsed, exportsLeft.
 */
export async function getEntitlementSummary(who: Who, productId: string) {
  const now = new Date();

  // identity: prefer userId; if no user, allow guestId
  const identityOR: Array<{ userId?: string; guestId?: string }> = [];
  if (who.userId) identityOR.push({ userId: who.userId });
  if (!who.userId && who.guestId) identityOR.push({ guestId: who.guestId });

  if (identityOR.length === 0) {
    return { exportQuota: 0, exportsUsed: 0, exportsLeft: 0 };
  }

  const ents = await prisma.designEntitlement.findMany({
    where: {
      productId,
      AND: [
        { OR: identityOR },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    select: { exportQuota: true, exportsUsed: true },
  });

  const exportQuota = ents.reduce((s, r) => s + (r.exportQuota ?? 0), 0);
  const exportsUsed = ents.reduce((s, r) => s + (r.exportsUsed ?? 0), 0);
  const exportsLeft = Math.max(0, exportQuota - exportsUsed);
  return { exportQuota, exportsUsed, exportsLeft };
}

/**
 * Purchased flag: did they purchase this product (user or guest)?
 * Mirrors old UserDesign.purchased semantics.
 */
export async function getPurchasedFlag(who: Who, productId: string) {
  const ors: Array<{ userId?: string; guestId?: string }> = [];
  if (who.userId) ors.push({ userId: who.userId });
  if (!who.userId && who.guestId) ors.push({ guestId: who.guestId });
  if (ors.length === 0) return false;

  const row = await prisma.purchasedDesign.findFirst({
    where: { productId, OR: ors },
    select: { id: true },
  });
  return !!row;
}

/**
 * Atomically consume ONE export credit with idempotency.
 * - Finds an active entitlement with exports left (ordered soonest expiring first)
 * - Performs a conditional UPDATE exportsUsed < exportQuota (raw SQL)
 * - Creates a DesignUsage row with unique idempotencyKey
 * - If idempotencyKey exists, we revert the decrement and return { ok:true, already:true }
 */
export async function consumeOneExportCredit(opts: {
  who: Who;
  productId: string;
  userDesignId?: string | null;
  purchasedDesignId?: string | null;
  idempotencyKey: string;
  meta?: {
    format?: string | null;
    width?: number | null;
    height?: number | null;
    extra?: Record<string, any>;
  };
}) {
  const { who, productId, userDesignId, purchasedDesignId, idempotencyKey, meta } = opts;
  const now = new Date();

  // identity: prefer userId; if no user, allow guestId
  const identityOR: Array<{ userId?: string; guestId?: string }> = [];
  if (who.userId) identityOR.push({ userId: who.userId });
  if (!who.userId && who.guestId) identityOR.push({ guestId: who.guestId });
  if (identityOR.length === 0) return { ok: false as const, reason: "no_identity" as const };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Idempotency short-circuit
      const existing = await tx.designUsage.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return { ok: true as const, already: true as const };
      }

      // Gather candidate entitlements (don’t try column<column in filters)
      const candidates = await tx.designEntitlement.findMany({
        where: {
          productId,
          AND: [
            { OR: identityOR },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            { exportQuota: { gt: 0 } },
          ],
        },
        orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      if (candidates.length === 0) {
        return { ok: false as const, reason: "no_entitlement" as const };
      }

      // Try to atomically decrement one that still has credits.
      let pickedId: string | null = null;
      for (const c of candidates) {
        const updated = await tx.$executeRaw`
          UPDATE "DesignEntitlement"
             SET "exportsUsed" = "exportsUsed" + 1,
                 "updatedAt"  = NOW()
           WHERE "id" = ${c.id}
             AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
             AND "exportsUsed" < "exportQuota"
        `;
        if (Number(updated) === 1) {
          pickedId = c.id;
          break;
        }
      }

      if (!pickedId) {
        return { ok: false as const, reason: "no_credits" as const };
      }

      // Record usage (idempotent). If unique conflict, revert decrement.
      try {
        await tx.designUsage.create({
          data: {
            kind: "EXPORT",
            entitlementId: pickedId,
            userId: who.userId ?? null,
            guestId: who.userId ? null : (who.guestId ?? null),
            productId,
            userDesignId: userDesignId ?? null,
            purchasedDesignId: purchasedDesignId ?? null,
            idempotencyKey,
            format: meta?.format ?? null,
            width: meta?.width ?? null,
            height: meta?.height ?? null,
    meta: meta?.extra as Prisma.InputJsonValue | undefined, // ← no `null`
          },
        });
      } catch (e: any) {
        if (e?.code === "P2002") {
          // Undo the decrement because this attempt is a duplicate
          await tx.$executeRaw`
            UPDATE "DesignEntitlement"
               SET "exportsUsed" = "exportsUsed" - 1,
                   "updatedAt"  = NOW()
             WHERE "id" = ${pickedId}
          `;
          return { ok: true as const, already: true as const };
        }
        throw e;
      }

      return { ok: true as const };
    });

    return result;
  } catch (e) {
    console.error("consumeOneExportCredit error", e);
    return { ok: false as const, reason: "tx_error" as const };
  }
}


export type PurchaseKind = "DIGITAL" | "PRINT";

// NEW: get which purchase kinds exist for this user/guest + product
export async function getPurchasedKinds(who: Who, productId: string): Promise<PurchaseKind[]> {
  const ors: Array<{ userId?: string; guestId?: string }> = [];
  if (who.userId) ors.push({ userId: who.userId });
  if (!who.userId && who.guestId) ors.push({ guestId: who.guestId });
  if (ors.length === 0) return [];

  const rows = await prisma.purchasedDesign.findMany({
    where: { productId, OR: ors },
    select: { orderItem: { select: { type: true } } }, // VariantType: DIGITAL | PRINT
  });

  const kinds = new Set<PurchaseKind>();
  for (const r of rows) {
    const t = r.orderItem?.type;
    if (t === "DIGITAL" || t === "PRINT") kinds.add(t);
  }
  return Array.from(kinds);
}

// (keep your existing getEntitlementSummary, getPurchasedFlag, consumeOneExportCredit)
