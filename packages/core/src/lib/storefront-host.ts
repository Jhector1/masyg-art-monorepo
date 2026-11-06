import {
  normalizeVerifiedHostname, resolvePublishedStoreByDomain,
  resolvePublishedLocalPreviewStore, PublicCatalogError,
} from "./public-catalog";

/** Local preview is intentionally narrow: loopback Host only, no forwarded hosts or arbitrary subdomains. */
export function isLocalPreviewHostHeader(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 260 || /[\s,@/\\]/.test(value)) return false;
  const match = /^(localhost|127\.0\.0\.1)(?::([0-9]{1,5}))?$/i.exec(value);
  if (!match) return false;
  if (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535)) return false;
  return true;
}

/** Only use the actual HTTP Host header supplied by trusted ingress; never X-Forwarded-Host. */
export function normalizePublicHostHeader(value: unknown): string {
  // Only Next.js development servers can use a server-configured, published local preview store.
  if (process.env.NODE_ENV === "development" && isLocalPreviewHostHeader(value)) {
    return String(value).split(":")[0].toLowerCase();
  }
  if (typeof value !== "string" || value.length > 260 || /[\s,@/\\]/.test(value)) {
    throw new PublicCatalogError(404);
  }
  const parts = value.split(":");
  if (parts.length > 2 || !parts[0]) throw new PublicCatalogError(404);
  if (parts.length === 2) {
    if (!/^[0-9]{1,5}$/.test(parts[1])) throw new PublicCatalogError(404);
    const port = Number(parts[1]);
    if (port < 1 || port > 65535) throw new PublicCatalogError(404);
  }
  return normalizeVerifiedHostname(parts[0]);
}

export async function resolvePublicStoreFromHostHeader(host: unknown) {
  const hostname = normalizePublicHostHeader(host);
  if (process.env.NODE_ENV === "development" &&
      (hostname === "localhost" || hostname === "127.0.0.1")) {
    // Both identifiers must be supplied by the server environment, never by the buyer/browser.
    const organizationId = process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID;
    const storeId = process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID;
    if (!organizationId || !storeId) throw new PublicCatalogError(404);
    return resolvePublishedLocalPreviewStore({ organizationId, storeId });
  }
  return resolvePublishedStoreByDomain(hostname);
}
