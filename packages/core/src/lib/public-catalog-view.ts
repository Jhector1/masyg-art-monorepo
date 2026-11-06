/** Public-only catalog projection used by both storefronts. No merchant API or secret refs. */
export type PublicFulfillment = "PHYSICAL" | "DIGITAL";
export type PublicVariant = {
  id: string;
  name: string;
  attributes: unknown;
  /** Server-verified offering kind; null for unlinked legacy variants. */
  offeringKind?: "ORIGINAL" | "PRINT" | "DOWNLOAD" | "MERCHANDISE" | null;
  fulfillment: PublicFulfillment;
  priceMinor: number;
  compareAtMinor: number | null;
  currency: string;
  available: boolean;
};
export type PublicCatalogItem = {
  slug: string;
  product: {
    id: string;
    title: string;
    description: string;
    offersDigitalLicenses?: boolean;
    offersFraming?: boolean;
    offersGlazing?: boolean;
    categories?: string[];
    publicMedia: Array<{assetId: string; altText: string | null; mimeType: string}>;
    variants: PublicVariant[];
  };
};
export type PublicStoreContext = {store: {id: string; name: string; slug: string}};
export type PublicCatalogPage = PublicStoreContext & {products: PublicCatalogItem[]; page: number};
export type PublicCatalogDetail = PublicStoreContext & PublicCatalogItem;

export function isPublicOriginal(variant: PublicVariant): boolean {
  if (variant.fulfillment !== "PHYSICAL") return false;
  // v39B conservatively backfilled older physical goods as MERCHANDISE.
  // Preserve original-art metadata in that case until the merchant reclassifies.
  // Explicit PRINT always overrides obsolete original metadata.
  if (variant.offeringKind === "ORIGINAL") return true;
  if (variant.offeringKind === "PRINT" || variant.offeringKind === "DOWNLOAD") return false;
  const attrs = variant.attributes;
  if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) return false;
  const a = attrs as Record<string, unknown>;
  // An original is an explicit merchant designation, NOT every physical artwork.
  return a.original === true ||
    [a.edition, a.editionType, a.productKind, a.kind].some(
      value => typeof value === "string" && value.toUpperCase() === "ORIGINAL"
    );
}

export function visibleVariants(item: PublicCatalogItem, focus: "ALL" | "ORIGINAL" = "ALL") {
  return item.product.variants.filter(v => focus !== "ORIGINAL" || isPublicOriginal(v));
}

export function catalogMediaPath(storeId: string, assetId: string) {
  // Inputs originate only from the store-context and scoped published catalog endpoints.
  return `/api/public/stores/${encodeURIComponent(storeId)}/media/${encodeURIComponent(assetId)}`;
}

export function formatCatalogPrice(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor) || minor < 0 || !/^[A-Z]{3}$/.test(currency)) return "Price unavailable";
  try {
    const formatter = new Intl.NumberFormat("en-US", {style: "currency", currency});
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(minor / (10 ** digits));
  } catch { return "Price unavailable"; }
}

async function loadJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {credentials: "same-origin", cache: "no-store", signal});
  if (!response.ok) {
    // Only reveal actionable configuration hints when troubleshooting the local development storefront.
    if (path === "/api/public/store-context" && response.status === 404 &&
        typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      const body: unknown = await response.json().catch(() => null);
      if (body && typeof body === "object" && "error" in body &&
          typeof body.error === "string" && body.error.startsWith("Local storefront ")) {
        throw new Error(body.error);
      }
    }
    throw new Error(`Storefront request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Host mapping is server-verified. Neither a browser user ID nor a query string selects a tenant. */
export async function fetchPublishedStore(signal?: AbortSignal) {
  return loadJson<PublicStoreContext>("/api/public/store-context", signal);
}

export async function fetchPublishedListings(storeId: string, signal?: AbortSignal) {
  return loadJson<PublicCatalogPage>(`/api/public/stores/${encodeURIComponent(storeId)}/products?limit=50`, signal);
}

export async function fetchPublishedListing(storeId: string, slug: string, signal?: AbortSignal) {
  return loadJson<PublicCatalogDetail>(
    `/api/public/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(slug)}`, signal
  );
}
