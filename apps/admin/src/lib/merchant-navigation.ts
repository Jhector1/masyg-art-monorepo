/** Pure URL helpers for server pages and client navigation. */
export function storeQuery(storeId: string) { return `?store=${encodeURIComponent(storeId)}`; }
export function productHref(storeId: string, productId: string) {
  return `/merchant/products/${encodeURIComponent(productId)}${storeQuery(storeId)}`;
}
