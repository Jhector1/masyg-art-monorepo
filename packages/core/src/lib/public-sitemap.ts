import { prisma } from "@acme/core/lib/prisma";
import { resolvePublicStoreFromHostHeader } from "./storefront-host";

/** Return only published listings attached to the VERIFIED host's storefront.
 * This intentionally does not expose draft/archived products or cross-tenant listings.
 */
export async function listPublishedSitemapListings(host: unknown) {
  const store = await resolvePublicStoreFromHostHeader(host);
  const rows = await prisma.storeListing.findMany({
    where: {
      organizationId: store.organizationId,
      storeId: store.id,
      status: "PUBLISHED",
      store: { published: true },
      product: { status: "PUBLISHED", variants: { some: { active: true } } },
    },
    select: { slug: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { productId: "asc" }],
    take: 500,
  });
  return { store: { id: store.id, slug: store.slug, name: store.name }, listings: rows };
}
