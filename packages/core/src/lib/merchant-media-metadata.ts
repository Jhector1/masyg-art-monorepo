/** Product-level gallery alt text and immutable digital-file lifecycle.
 * Purchased-file snapshots and digital grants intentionally remain usable after retirement.
 */
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess, validateTenantId, TenantAccessError } from "./tenancy";

export class MediaMetadataError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 400) { super(message); this.name = "MediaMetadataError"; }
}
export function cleanImageAlt(input: unknown): string {
  if (typeof input !== "string") throw new MediaMetadataError("Alternative text must be a string");
  const value = input.trim();
  if (value.length > 180 || /[\u0000-\u001f\u007f]/.test(value)) throw new MediaMetadataError("Alternative text must be at most 180 characters without control characters");
  return value;
}
export async function updateMerchantImageAlt(args: { userId: string; organizationId: string; productId: string; assetId: string; altText: unknown }) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const productId = validateTenantId(args.productId), assetId = validateTenantId(args.assetId);
  const altText = cleanImageAlt(args.altText);
  return prisma.$transaction(async tx => {
    const item = await tx.productMedia.findFirst({ where: { organizationId: scope.organizationId, productId, assetId,
      product: { status: { not: "ARCHIVED" } }, asset: { private: false } }, select: { assetId: true } });
    if (!item) throw new TenantAccessError(404);
    await tx.productMedia.update({ where: { organizationId_productId_assetId: { organizationId: scope.organizationId, productId, assetId } }, data: { altText: altText || null } });
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: args.userId,
      action: "catalog.gallery.alt_updated", targetType: "MediaAsset", targetId: assetId,
      metadata: { productId, altText } } });
    return { assetId, altText };
  });
}
/** Retire for future carts without deleting bytes referenced by earlier order snapshots. */
export async function retireMerchantDigitalFile(args: { userId: string; organizationId: string; productId: string; digitalFileId: string }) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const productId = validateTenantId(args.productId), digitalFileId = validateTenantId(args.digitalFileId);
  return prisma.$transaction(async tx => {
    const file = await tx.digitalFile.findFirst({ where: { id: digitalFileId, organizationId: scope.organizationId,
      retiredAt: null, variant: { productId, product: { status: { not: "ARCHIVED" } } }, asset: { private: true } }, select: { id: true } });
    if (!file) throw new TenantAccessError(404);
    const retired = await tx.digitalFile.updateMany({ where: { id: digitalFileId, organizationId: scope.organizationId, retiredAt: null }, data: { retiredAt: new Date() } });
    if (retired.count !== 1) throw new MediaMetadataError("Digital file has already been retired; refresh and try again", 409);
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: args.userId,
      action: "catalog.digital-file.retired", targetType: "DigitalFile", targetId: digitalFileId, metadata: { productId } } });
    return { digitalFileId, retired: true as const };
  });
}
