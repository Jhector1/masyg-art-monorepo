import { z } from "zod";
import { prisma } from "@acme/core/lib/prisma";
import { CatalogStateError } from "./catalog-lifecycle";
import { requireMerchantAccess, TenantAccessError, validateTenantId } from "./tenancy";

export const locationInput = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export const stockAdjustmentInput = z.object({
  storeId: z.string().min(3).max(128),
  variantId: z.string().min(3).max(128),
  locationId: z.string().min(3).max(128),
  delta: z.number().int().min(-100000).max(100000).refine(v => v !== 0),
  reason: z.string().trim().min(3).max(200),
}).strict();
const MAX_STOCK = 2147483647;

export async function listMerchantInventory(args: { userId: string; organizationId: string; storeId: string }) {
  const scope = await requireMerchantAccess({ ...args, capability: "read" });
  const [locations, listings] = await Promise.all([
    prisma.inventoryLocation.findMany({ where: { organizationId: scope.organizationId },
      select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 }),
    prisma.storeListing.findMany({ where: { organizationId: scope.organizationId, storeId: scope.storeId! },
      select: { product: { select: { id: true, title: true, variants: {
        where: { fulfillment: "PHYSICAL" },
        select: { id: true, name: true, sku: true, inventoryPolicy: true,
          inventory: { select: { locationId: true, onHand: true, reserved: true } } },
      } } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { locations, products: listings.map(l => l.product), cappedAt: 100 };
}

export async function createMerchantLocation(args: { userId: string; organizationId: string; body: unknown }) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const input = locationInput.parse(args.body);
  return prisma.inventoryLocation.create({ data: { organizationId: scope.organizationId, name: input.name } });
}

/** Never edit reserved stock. Serializable transactions prevent losing reservations during stock decrements. */
export async function adjustMerchantStock(args: { userId: string; organizationId: string; body: unknown }) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const input = stockAdjustmentInput.parse(args.body);
  const storeId = validateTenantId(input.storeId);
  const variantId = validateTenantId(input.variantId);
  const locationId = validateTenantId(input.locationId);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const [variant, location] = await Promise.all([
          tx.productVariant.findFirst({ where: { id: variantId, organizationId: scope.organizationId,
            fulfillment: "PHYSICAL", inventoryPolicy: "TRACKED", product: { status: { not: "ARCHIVED" } } },
            select: { id: true, productId: true } }),
          tx.inventoryLocation.findFirst({ where: { id: locationId, organizationId: scope.organizationId }, select: { id: true } }),
        ]);
        if (!variant || !location) throw new TenantAccessError(404);
        const listed = await tx.storeListing.findUnique({ where: { organizationId_storeId_productId: {
          organizationId: scope.organizationId, storeId, productId: variant.productId,
        } }, select: { storeId: true } });
        if (!listed) throw new TenantAccessError(404);
        const key = { organizationId: scope.organizationId, variantId, locationId };
        const current = await tx.inventoryLevel.findUnique({ where: { organizationId_variantId_locationId: key },
          select: { onHand: true, reserved: true } });
        const next = (current?.onHand ?? 0) + input.delta;
        if (next < (current?.reserved ?? 0) || next > MAX_STOCK) {
          throw new CatalogStateError("Adjustment would reduce stock below reserved units or exceed the stock limit");
        }
        const level = current
          ? await tx.inventoryLevel.update({ where: { organizationId_variantId_locationId: key },
              data: { onHand: next } })
          : await tx.inventoryLevel.create({ data: { ...key, onHand: next } });
        await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId,
          actorUserId: args.userId, action: "inventory.stock.adjusted", targetType: "ProductVariant", targetId: variantId,
          metadata: { storeId, locationId, delta: input.delta, reason: input.reason, before: current?.onHand ?? 0, after: next },
        } });
        return { onHand: level.onHand, reserved: level.reserved, available: level.onHand - level.reserved };
      }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
    } catch (error) {
      // Retry only Prisma's documented transaction write-conflict code.
      // The error constructor is not available in every Prisma runtime/Jest
      // environment; inspecting an actual Error's code avoids throwing from
      // the catch block and masking an inventory validation error.
      if (error instanceof Error && "code" in error && error.code === "P2034") {
        if (attempt < 2) continue;
        throw new CatalogStateError("Concurrent stock adjustment; please retry");
      }
      throw error;
    }
  }
  throw new CatalogStateError("Concurrent stock update; retry");
}
