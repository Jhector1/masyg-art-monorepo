import type { ProductDetailResult } from "../types";
import { getCurrentStorefront } from "../lib/client/storefront-commerce";
/** Studio identifier is the published listing slug, never an arbitrary product ID or userId. */
export async function fetchProductById(slug: string, _ignoredUserId?: string): Promise<ProductDetailResult> {
  const store = await getCurrentStorefront();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) throw new Error("Invalid listing slug");
  const res = await fetch(`/api/public/stores/${encodeURIComponent(store.store.id)}/studio-products/${encodeURIComponent(slug)}`, {
    credentials: "same-origin",cache:"no-store",
  });
  if (!res.ok) throw new Error(`Studio catalog unavailable (${res.status})`);
  return res.json() as Promise<ProductDetailResult>;
}
