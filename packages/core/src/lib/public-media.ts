import { prisma } from "@acme/core/lib/prisma";
import { PublicCatalogError, requirePublicStoreId, resolvePublishedStore } from "./public-catalog";

/** Resolve ONLY published, non-private preview media within a server-resolved store.
 * Do not expose storage keys to the browser; the server redirects to sanitized Cloudinary delivery.
 */
export async function getPublishedPreviewStorageKey(args: { storeId: string; assetId: string }): Promise<string> {
  const store = await resolvePublishedStore(requirePublicStoreId(args.storeId));
  const media = await prisma.productMedia.findFirst({
    where: {
      organizationId: store.organizationId,
      assetId: requirePublicStoreId(args.assetId),
      asset: { private: false },
      product: { status: "PUBLISHED", listings: { some: {
        organizationId: store.organizationId, storeId: store.id, status: "PUBLISHED",
      } } },
    },
    select: { asset: { select: { storageKey: true } } },
  });
  if (!media) throw new PublicCatalogError(404);
  return media.asset.storageKey;
}
