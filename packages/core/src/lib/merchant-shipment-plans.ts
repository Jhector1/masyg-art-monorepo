/** Internal, unfulfilled shipment plans. Does NOT mark a package shipped, consume stock,
 * settle a payment, issue a refund, or mutate the authoritative order status. */
import { createHash } from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import { z } from "zod";
import { CatalogStateError } from "./catalog-lifecycle";
import { requireMerchantAccess, TenantAccessError, validateTenantId } from "./tenancy";

export const shipmentPlanInput = z.object({
  clientRequestId: z.string().uuid(),
  carrier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  items: z.array(z.object({ orderItemId: z.string().min(3).max(128), quantity: z.number().int().positive().max(100000) }).strict()).min(1).max(30),
}).strict();
export async function planMerchantShipment(args: {
  userId: string; organizationId: string; storeId: string; orderId: string; body: unknown;
}) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId,
    storeId: args.storeId, capability: "manage" });
  const orderId = validateTenantId(args.orderId);
  const input = shipmentPlanInput.parse(args.body);
  if (new Set(input.items.map(i => i.orderItemId)).size !== input.items.length)
    throw new CatalogStateError("Duplicate order item in shipment plan");
  const planKey = createHash("sha256").update(`${scope.organizationId}:${scope.storeId}:${orderId}:${input.clientRequestId}`).digest("hex");
  const planFingerprint = createHash("sha256").update(JSON.stringify({
    carrier: input.carrier || "", trackingNumber: input.trackingNumber || "",
    items: [...input.items].sort((a,b)=>a.orderItemId.localeCompare(b.orderItemId)),
  })).digest("hex");
  return prisma.$transaction(async tx => {
    // Recheck access in the SAME transaction that writes the plan.
    const member = await tx.organizationMember.findUnique({ where: { organizationId_userId: {
      organizationId: scope.organizationId, userId: args.userId,
    } }, select: { role: true } });
    if (member?.role !== "OWNER" && member?.role !== "ADMIN") throw new TenantAccessError(404);
    const existing = await tx.shipment.findUnique({ where: { planKey }, select: { id: true, status: true, planFingerprint: true } });
    if (existing) {
      if (existing.planFingerprint !== planFingerprint) throw new CatalogStateError("Shipment request key was reused with different details");
      return { id: existing.id, status: existing.status, reused: true };
    }
    const order = await tx.order.findFirst({ where: { id: orderId, organizationId: scope.organizationId, storeId: scope.storeId },
      select: { id: true, status: true, items: { select: { id: true, fulfillment: true, quantity: true } },
        shipments: { select: { items: { select: { orderItemId: true, quantity: true } } } } } });
    if (!order) throw new TenantAccessError(404);
    if (order.status !== "PAID" && order.status !== "FULFILLING")
      throw new CatalogStateError("Only paid orders can have shipment plans");
    const ordered = new Map(order.items.filter(i => i.fulfillment === "PHYSICAL").map(i => [i.id, i.quantity]));
    const alreadyPlanned = new Map<string,number>();
    for (const shipment of order.shipments) for (const item of shipment.items)
      alreadyPlanned.set(item.orderItemId,(alreadyPlanned.get(item.orderItemId) || 0) + item.quantity);
    for (const item of input.items) {
      const quantity = ordered.get(item.orderItemId);
      if (!quantity || (alreadyPlanned.get(item.orderItemId) || 0) + item.quantity > quantity)
        throw new CatalogStateError("Shipment quantity exceeds unplanned physical order units");
    }
    const shipment = await tx.shipment.create({ data: { organizationId: scope.organizationId, storeId: scope.storeId!,
      orderId, planKey, planFingerprint, status: "PENDING", carrier: input.carrier || null, trackingNumber: input.trackingNumber || null },
      select: { id: true, status: true } });
    await tx.shipmentItem.createMany({ data: input.items.map(item => ({
      organizationId: scope.organizationId, shipmentId: shipment.id, orderItemId: item.orderItemId, quantity: item.quantity,
    })) });
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: args.userId,
      action: "merchant.shipment.plan.created", targetType: "Order", targetId: orderId,
      metadata: { shipmentId: shipment.id, storeId: scope.storeId, itemCount: input.items.length } } });
    return { ...shipment, reused: false };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
}
