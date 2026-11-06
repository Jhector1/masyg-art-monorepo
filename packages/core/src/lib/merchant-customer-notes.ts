/** Private operator notes; never returned from public catalog or customer APIs. */
import { prisma } from "@acme/core/lib/prisma";
import { z } from "zod";
import { requireMerchantAccess, validateTenantId, TenantAccessError } from "./tenancy";

export const customerNoteInput = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
async function scope(userId: string, organizationId: string, storeId: string, customerId: string) {
  const access = await requireMerchantAccess({ userId, organizationId, storeId, capability: "manage" });
  const id = validateTenantId(customerId);
  const visible = await prisma.customer.findFirst({ where: { organizationId: access.organizationId, id,
    orders: { some: { storeId: access.storeId! } } }, select: { id: true } });
  if (!visible) throw new TenantAccessError(404);
  return { organizationId: access.organizationId, storeId: access.storeId!, customerId: id };
}
export async function listMerchantCustomerNotes(args: { userId: string; organizationId: string; storeId: string; customerId: string }) {
  const where = await scope(args.userId, args.organizationId, args.storeId, args.customerId);
  return prisma.customerNote.findMany({ where, select: { id: true, body: true, actorUserId: true, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 100 });
}
export async function addMerchantCustomerNote(args: { userId: string; organizationId: string; storeId: string; customerId: string; body: unknown }) {
  const input = customerNoteInput.parse(args.body);
  const where = await scope(args.userId, args.organizationId, args.storeId, args.customerId);
  return prisma.$transaction(async tx => {
    const member = await tx.organizationMember.findUnique({ where: { organizationId_userId: {
      organizationId: where.organizationId, userId: args.userId,
    } }, select: { role: true } });
    if (member?.role !== "OWNER" && member?.role !== "ADMIN") throw new TenantAccessError(404);
    const customer = await tx.customer.findFirst({ where: { id: where.customerId, organizationId: where.organizationId,
      orders: { some: { storeId: where.storeId } } }, select: { id: true } });
    if (!customer) throw new TenantAccessError(404);
    const note = await tx.customerNote.create({ data: { ...where, actorUserId: args.userId, body: input.body },
      select: { id: true, body: true, createdAt: true } });
    await tx.merchantAuditLog.create({ data: { organizationId: where.organizationId, actorUserId: args.userId,
      action: "merchant.customer.note.added", targetType: "Customer", targetId: where.customerId,
      metadata: { storeId: where.storeId, noteId: note.id } } });
    return note;
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
}
