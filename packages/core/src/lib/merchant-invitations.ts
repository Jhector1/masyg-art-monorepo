/** Hashed, expiring one-use organization invitations. No membership is granted by sending mail.
 * Delivery occurs outside the DB transaction and a returned URL/token must NEVER reach an Admin API response. */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import { z } from "zod";
import { CatalogStateError } from "./catalog-lifecycle";
import { requireMerchantAccess, TenantAccessError, validateTenantId } from "./tenancy";

export const invitationInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  storeId: z.string().min(3).max(128).optional(),
}).strict();
const tokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,90}$/) }).strict();
const digest = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export async function listMerchantInvitations(actorId: string, organizationId: string) {
  const scope = await requireMerchantAccess({ userId: actorId, organizationId, capability: "manage" });
  if (scope.role !== "OWNER") throw new TenantAccessError(404);
  return prisma.staffInvitation.findMany({
    where: { organizationId: scope.organizationId },
    select: { id: true, email: true, role: true, storeId: true, deliveryStatus: true,
      createdAt: true, sentAt: true, expiresAt: true, acceptedAt: true, revokedAt: true },
    orderBy: { createdAt: "desc" }, take: 100,
  });
}

export async function createMerchantInvitation(actorId: string, organizationId: string, body: unknown) {
  const scope = await requireMerchantAccess({ userId: actorId, organizationId, capability: "manage" });
  const input = invitationInput.parse(body);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = digest(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const created = await prisma.$transaction(async tx => {
    const actor = await tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: scope.organizationId, userId: actorId } },
      select: { role: true },
    });
    if (actor?.role !== "OWNER") throw new TenantAccessError(404);
    if (input.role === "OWNER") throw new CatalogStateError("Owner invitations are disabled; promote an existing member with explicit approval");
    if (input.role === "MEMBER" && !input.storeId) throw new CatalogStateError("Select a storefront for a viewer");
    const storeId = input.role === "MEMBER" ? validateTenantId(input.storeId) : null;
    if (storeId) {
      const store = await tx.storefront.findFirst({ where: { id: storeId, organizationId: scope.organizationId }, select: { id: true } });
      if (!store) throw new TenantAccessError(404);
    }
    const member = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (member && await tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: scope.organizationId, userId: member.id } }, select: { userId: true },
    })) throw new CatalogStateError("This email already belongs to an organization member");
    // Expired/failed invites are superseded. Keep full history but clear their active unique key.
    const activeKey = `${scope.organizationId}:${input.email}`;
    const open = await tx.staffInvitation.findUnique({ where: { activeKey }, select: { id: true, expiresAt: true, deliveryStatus: true } });
    if (open) {
      if (open.expiresAt > now && open.deliveryStatus !== "FAILED") throw new CatalogStateError("An active invitation already exists for this email");
      await tx.staffInvitation.update({ where: { id: open.id }, data: { activeKey: null, revokedAt: now } });
    }
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (await tx.staffInvitation.count({ where: { organizationId: scope.organizationId, createdAt: { gt: hourAgo } } }) >= 30)
      throw new CatalogStateError("Invitation rate limit reached. Try again later");
    if (await tx.staffInvitation.count({ where: { organizationId: scope.organizationId, email: input.email, createdAt: { gt: hourAgo } } }) >= 3)
      throw new CatalogStateError("Too many invitations for this address");
    const invitation = await tx.staffInvitation.create({ data: {
      organizationId: scope.organizationId, email: input.email, role: input.role,
      storeId, tokenHash, activeKey, expiresAt, createdByUserId: actorId,
    }, select: { id: true } });
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: actorId,
      action: "merchant.invitation.created", targetType: "StaffInvitation", targetId: invitation.id,
      metadata: { role: input.role, storeId, email: input.email } } });
    return invitation;
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
  // Internal use by authenticated server-side delivery route ONLY. Never JSON-serialize token to the browser.
  return { invitationId: created.id, token, email: input.email, role: input.role };
}

export async function recordInvitationDelivery(invitationId: string, delivered: boolean, providerMessageId?: string) {
  await prisma.staffInvitation.updateMany({ where: { id: invitationId, deliveryStatus: "PENDING" }, data: {
    deliveryStatus: delivered ? "SENT" : "FAILED",
    ...(delivered ? { sentAt: new Date(), providerMessageId: providerMessageId?.slice(0, 128) } : {}),
  } });
}

export async function revokeMerchantInvitation(actorId: string, organizationId: string, invitationId: string) {
  const scope = await requireMerchantAccess({ userId: actorId, organizationId, capability: "manage" });
  const id = validateTenantId(invitationId);
  return prisma.$transaction(async tx => {
    const actor = await tx.organizationMember.findUnique({ where: { organizationId_userId: {
      organizationId: scope.organizationId, userId: actorId,
    } }, select: { role: true } });
    if (actor?.role !== "OWNER") throw new TenantAccessError(404);
    const row = await tx.staffInvitation.findFirst({ where: { id, organizationId: scope.organizationId, acceptedAt: null, revokedAt: null }, select: { id: true } });
    if (!row) throw new TenantAccessError(404);
    const updated = await tx.staffInvitation.updateMany({ where: { id, organizationId: scope.organizationId,
      acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date(), activeKey: null } });
    if (updated.count !== 1) throw new CatalogStateError("Invitation already changed");
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: actorId,
      action: "merchant.invitation.revoked", targetType: "StaffInvitation", targetId: id } });
    return { revoked: true };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
}

export async function acceptMerchantInvitation(userId: string, body: unknown) {
  if (!userId) throw new TenantAccessError(401, "Sign in to accept this invitation");
  const token = tokenInput.parse(body).token;
  const hash = digest(token);
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user?.email) throw new TenantAccessError(401, "Sign in to accept this invitation");
    const invitation = await tx.staffInvitation.findUnique({ where: { tokenHash: hash }, select: {
      id: true, organizationId: true, email: true, role: true, storeId: true,
      expiresAt: true, acceptedAt: true, revokedAt: true, deliveryStatus: true,
    } });
    if (!invitation || invitation.role === "OWNER" || invitation.deliveryStatus !== "SENT" || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date())
      throw new TenantAccessError(404, "Invitation unavailable or expired");
    if (user.email.trim().toLowerCase() !== invitation.email)
      throw new TenantAccessError(403, "Sign in with the invited email address");
    const existing = await tx.organizationMember.findUnique({ where: { organizationId_userId: {
      organizationId: invitation.organizationId, userId,
    } }, select: { role: true } });
    if (existing) throw new CatalogStateError("This account is already a member");
    const claimed = await tx.staffInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null,
      deliveryStatus: "SENT", expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date(), activeKey: null } });
    if (claimed.count !== 1) throw new CatalogStateError("Invitation was already used");
    await tx.organizationMember.create({ data: { organizationId: invitation.organizationId, userId, role: invitation.role } });
    if (invitation.role === "MEMBER") {
      if (!invitation.storeId) throw new CatalogStateError("Invitation has no storefront");
      const store = await tx.storefront.findFirst({ where: { id: invitation.storeId, organizationId: invitation.organizationId }, select: { id: true } });
      if (!store) throw new TenantAccessError(404);
      await tx.storeMember.create({ data: { organizationId: invitation.organizationId, storeId: invitation.storeId, userId, role: "VIEWER" } });
    }
    await tx.merchantAuditLog.create({ data: { organizationId: invitation.organizationId, actorUserId: userId,
      action: "merchant.invitation.accepted", targetType: "StaffInvitation", targetId: invitation.id,
      metadata: { role: invitation.role, storeId: invitation.storeId } } });
    return { accepted: true, organizationId: invitation.organizationId, role: invitation.role };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
}
