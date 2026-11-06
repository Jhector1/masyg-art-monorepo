/** Staff is separate from buyers. Only an existing verified platform User can be enrolled.
 * No invitations or email delivery is performed by these actions. */
import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { CatalogStateError } from "./catalog-lifecycle";
import { requireMerchantAccess, TenantAccessError, validateTenantId } from "./tenancy";

export const staffAddInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  storeId: z.string().min(3).max(128).optional(),
}).strict();
export const staffRoleInput = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  storeId: z.string().min(3).max(128).optional(),
}).strict();
export const staffGrantInput = z.object({ storeId: z.string().min(3).max(128) }).strict();

export async function listMerchantStaff(userId: string, organizationId: string) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  return prisma.organizationMember.findMany({ where: { organizationId: scope.organizationId }, select: {
    userId: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } },
    // Store roles currently only grant VIEWER to org MEMBER. Editors require a separate reviewed policy.
  }, orderBy: [{ createdAt: "asc" }, { userId: "asc" }], take: 200 });
}

async function requireOwnerInsideTx(tx: Prisma.TransactionClient, organizationId: string, actorUserId: string) {
  const actor = await tx.organizationMember.findUnique({ where: {
    organizationId_userId: { organizationId, userId: actorUserId },
  }, select: { role: true } });
  if (actor?.role !== "OWNER") throw new TenantAccessError(404);
}
async function requireStoreInsideTx(tx: Prisma.TransactionClient, organizationId: string, rawStoreId: string | undefined) {
  if (!rawStoreId) throw new CatalogStateError("Select a storefront for a viewer");
  const storeId = validateTenantId(rawStoreId);
  const store = await tx.storefront.findFirst({ where: { id: storeId, organizationId }, select: { id: true } });
  if (!store) throw new TenantAccessError(404);
  return storeId;
}
async function guardOwnerRemoval(tx: Prisma.TransactionClient, organizationId: string, targetUserId: string, actorUserId: string, currentRole: string) {
  if (targetUserId === actorUserId) throw new CatalogStateError("Another owner must change your access");
  if (currentRole === "OWNER") {
    const owners = await tx.organizationMember.count({ where: { organizationId, role: "OWNER" } });
    if (owners <= 1) throw new CatalogStateError("Cannot remove the last organization owner");
  }
}
export async function addMerchantStaff(userId: string, organizationId: string, body: unknown) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  const input = staffAddInput.parse(body);
  return prisma.$transaction(async tx => {
    await requireOwnerInsideTx(tx, scope.organizationId, userId);
    const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, name: true, email: true } });
    if (!existing) throw new CatalogStateError("User must create a ZileDigital account before you can add them");
    const membership = await tx.organizationMember.findUnique({ where: { organizationId_userId: {
      organizationId: scope.organizationId, userId: existing.id,
    } }, select: { userId: true } });
    if (membership) throw new CatalogStateError("This user is already a member");
    const storeId = input.role === "MEMBER" ? await requireStoreInsideTx(tx, scope.organizationId, input.storeId) : null;
    await tx.organizationMember.create({ data: { organizationId: scope.organizationId, userId: existing.id, role: input.role } });
    if (storeId) await tx.storeMember.create({ data: { organizationId: scope.organizationId, storeId, userId: existing.id, role: "VIEWER" } });
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: userId,
      action: "merchant.staff.added", targetType: "User", targetId: existing.id, metadata: { role: input.role, storeId } } });
    return { userId: existing.id, email: existing.email, role: input.role };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
}
export async function updateMerchantStaffRole(userId: string, organizationId: string, targetUserId: string, body: unknown) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  const targetId = validateTenantId(targetUserId);
  const input = staffRoleInput.parse(body);
  return prisma.$transaction(async tx => {
    await requireOwnerInsideTx(tx, scope.organizationId, userId);
    const current = await tx.organizationMember.findUnique({ where: { organizationId_userId: {
      organizationId: scope.organizationId, userId: targetId,
    } }, select: { role: true } });
    if (!current) throw new TenantAccessError(404);
    if (current.role !== input.role && current.role === "OWNER") await guardOwnerRemoval(tx, scope.organizationId, targetId, userId, current.role);
    if (targetId === userId && input.role !== "OWNER") throw new CatalogStateError("An owner cannot demote themselves");
    const storeId = input.role === "MEMBER" ? await requireStoreInsideTx(tx, scope.organizationId, input.storeId) : null;
    await tx.organizationMember.update({ where: { organizationId_userId: { organizationId: scope.organizationId, userId: targetId } }, data: { role: input.role } });
    // Downgrade removes all broader, potentially stale store grants; grant only chosen VIEWER store.
    await tx.storeMember.deleteMany({ where: { organizationId: scope.organizationId, userId: targetId } });
    if (storeId) await tx.storeMember.create({ data: { organizationId: scope.organizationId, userId: targetId, storeId, role: "VIEWER" } });
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: userId,
      action: "merchant.staff.role.updated", targetType: "User", targetId, metadata: { role: input.role, previousRole: current.role, storeId } } });
    return { userId: targetId, role: input.role };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
}
export async function removeMerchantStaff(userId: string, organizationId: string, targetUserId: string) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  const targetId = validateTenantId(targetUserId);
  return prisma.$transaction(async tx => {
    await requireOwnerInsideTx(tx, scope.organizationId, userId);
    const current = await tx.organizationMember.findUnique({ where: { organizationId_userId: {
      organizationId: scope.organizationId, userId: targetId,
    } }, select: { role: true } });
    if (!current) throw new TenantAccessError(404);
    await guardOwnerRemoval(tx, scope.organizationId, targetId, userId, current.role);
    await tx.storeMember.deleteMany({ where: { organizationId: scope.organizationId, userId: targetId } });
    await tx.organizationMember.delete({ where: { organizationId_userId: { organizationId: scope.organizationId, userId: targetId } } });
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: userId,
      action: "merchant.staff.removed", targetType: "User", targetId, metadata: { previousRole: current.role } } });
    return { removed: true };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
}
