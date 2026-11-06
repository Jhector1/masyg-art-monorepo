import type { Metadata } from "next";
import { getPublicProduct, PublicCatalogError } from "@acme/core/lib/public-catalog";
import { normalizePublicHostHeader, resolvePublicStoreFromHostHeader } from "@acme/core/lib/storefront-host";

type Options = {
  host: unknown;
  slug: string;
  siteName: string;
  fallbackDescription: string;
  keywords: string[];
};

/** SEO is generated from the same published, store-scoped listing as the storefront API.
 * Never query Product by a globally-unique ID without the verified storefront context.
 */
export async function publishedProductMetadata(options: Options): Promise<Metadata> {
  const notFound: Metadata = {
    title: `Artwork Not Found | ${options.siteName}`,
    description: "This artwork is unavailable.",
    robots: { index: false, follow: false },
  };
  try {
    const host = normalizePublicHostHeader(options.host);
    const store = await resolvePublicStoreFromHostHeader(host);
    const listing = await getPublicProduct({ storeId: store.id, slug: options.slug });
    const base = new URL(`https://${host}`);
    const canonical = new URL(`/store/${encodeURIComponent(listing.slug)}`, base).toString();
    const title = `${listing.product.title} | ${options.siteName}`;
    const description = listing.product.description?.trim().slice(0, 160) || options.fallbackDescription;
    const preview = listing.product.publicMedia[0];
    const image = preview ? new URL(
      `/api/public/stores/${encodeURIComponent(store.id)}/media/${encodeURIComponent(preview.assetId)}`, base
    ).toString() : null;
    return {
      title, description, metadataBase: base,
      alternates: { canonical }, keywords: [...options.keywords, listing.product.title],
      openGraph: {
        title, description, url: canonical, type: "website", siteName: options.siteName,
        ...(image ? { images: [{ url: image, alt: preview?.altText || listing.product.title }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary", title, description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch (error) {
    if (error instanceof PublicCatalogError) return notFound;
    throw error;
  }
}
