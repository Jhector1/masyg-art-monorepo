import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess, TenantAccessError } from "./tenancy";
import { CatalogStateError } from "./catalog-lifecycle";

/** Organization OWNER/ADMIN owns storefront publication. No global admin bypass. */
export async function setMerchantStorePublished(args: {
  userId: string;
  organizationId: string;
  storeId: string;
  published: boolean;
}) {
  // Store publication is an organization-level decision; a store-only grant is insufficient.
  await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId,
    storeId: args.storeId, capability: "manage" });
  if (typeof args.published !== "boolean") throw new Error("Invalid publication request");
  const where = { organizationId: scope.organizationId, id: scope.storeId! };
  return prisma.$transaction(async (tx) => {
    if (args.published) {
      // The readiness check and state change are serialized with the audit write.
      const readyListing = await tx.storeListing.findFirst({
        where: {
          organizationId: scope.organizationId, storeId: scope.storeId!, status: "PUBLISHED",
          product: { status: "PUBLISHED", variants: { some: { active: true } } },
        },
        select: { productId: true },
      });
      if (!readyListing) throw new CatalogStateError("Publish a catalog product and its store listing first");
    }
    const changed = await tx.storefront.updateMany({ where, data: { published: args.published } });
    if (changed.count !== 1) throw new TenantAccessError(404);
    await tx.merchantAuditLog.create({ data: {
      organizationId: scope.organizationId, actorUserId: args.userId,
      action: args.published ? "store.published" : "store.unpublished",
      targetType: "Storefront", targetId: scope.storeId!,
    } });
    return tx.storefront.findFirst({
      where, select: { id: true, slug: true, name: true, published: true },
    });
  });
}
