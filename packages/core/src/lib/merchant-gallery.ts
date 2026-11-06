/** Canonical organization-scoped product gallery management. No Cloudinary secrets here. */
import { prisma } from "@acme/core/lib/prisma";
import { orderedGalleryIds } from "./merchant-gallery-order";
import { requireMerchantAccess, validateTenantId, TenantAccessError } from "./tenancy";

export async function reorderMerchantGallery(args: {
  userId: string; organizationId: string; productId: string; orderedAssetIds: unknown;
}) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const productId = validateTenantId(args.productId);
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { id: productId, organizationId: scope.organizationId, status: { not: "ARCHIVED" } }, select: { id: true } });
    if (!product) throw new TenantAccessError(404);
    const media = await tx.productMedia.findMany({ where: { organizationId: scope.organizationId, productId, asset: { private: false } }, select: { assetId: true } });
    const ids = orderedGalleryIds(args.orderedAssetIds, media.map(item => item.assetId));
    for (let i = 0; i < ids.length; i++) {
      await tx.productMedia.update({ where: { organizationId_productId_assetId: { organizationId: scope.organizationId, productId, assetId: ids[i]! } }, data: { sortOrder: i } });
    }
    await tx.merchantAuditLog.create({ data: {
      organizationId: scope.organizationId, actorUserId: args.userId,
      action: "catalog.gallery.reordered", targetType: "Product", targetId: productId,
      metadata: { orderedAssetIds: ids },
    } });
    return { orderedAssetIds: ids };
  }, { timeout: 20000 });
}

/** Unlinks gallery image; callers perform Cloudinary cleanup if its asset was orphaned. */
export async function detachMerchantPreview(args: { userId: string; organizationId: string; productId: string; assetId: string }) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const productId = validateTenantId(args.productId), assetId = validateTenantId(args.assetId);
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { id: productId, organizationId: scope.organizationId, status: { not: "ARCHIVED" } }, select: { id: true } });
    if (!product) throw new TenantAccessError(404);
    const media = await tx.productMedia.findUnique({ where: { organizationId_productId_assetId: { organizationId: scope.organizationId, productId, assetId } }, select: { asset: { select: { storageKey: true, private: true } } } });
    if (!media || media.asset.private) throw new TenantAccessError(404);
    await tx.productMedia.delete({ where: { organizationId_productId_assetId: { organizationId: scope.organizationId, productId, assetId } } });
    const [otherMedia, digitalFiles] = await Promise.all([
      tx.productMedia.count({ where: { organizationId: scope.organizationId, assetId } }),
      tx.digitalFile.count({ where: { organizationId: scope.organizationId, assetId } }),
    ]);
    const storageKey = otherMedia === 0 && digitalFiles === 0 ? media.asset.storageKey : null;
    if (storageKey) await tx.mediaAsset.delete({ where: { id: assetId, organizationId: scope.organizationId } });
    await tx.merchantAuditLog.create({ data: {
      organizationId: scope.organizationId, actorUserId: args.userId,
      action: "catalog.gallery.image_detached", targetType: "MediaAsset", targetId: assetId,
      metadata: { productId, cleanupKey: storageKey ?? undefined },
    } });
    return { detached: true as const, storageKey };
  }, { timeout: 15000 });
}
