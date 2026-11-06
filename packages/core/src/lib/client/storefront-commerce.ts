"use client";
import type {PublicCatalogItem} from "../public-catalog-view";

/** One typed storefront transport for all brands. Server endpoints enforce tenant authorization. */
const storeIdPattern = /^[A-Za-z0-9_-]{3,128}$/;
const listingSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const STORE_CART_UPDATED_EVENT = "ziledigital:cart-updated";
function publishCartUpdate() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STORE_CART_UPDATED_EVENT));
}

export type PublicVariant = {
  id: string; name: string; attributes: unknown; fulfillment: "PHYSICAL" | "DIGITAL";
  priceMinor: number; currency: string; available: boolean;
};
export type PublicStoreProduct = PublicCatalogItem;
export type PublicProductsResponse = {
  store: {id: string; slug: string; name: string};
  page: number;
  products: PublicStoreProduct[];
};
export type CurrentStorefront = {store:{id:string;slug:string;name:string}};
export type BuyerOrderItem = {id:string;titleSnapshot:string;skuSnapshot:string|null;
  fulfillment:"PHYSICAL"|"DIGITAL";quantity:number;unitPriceMinor:number;totalMinor:number;variant?:{productId:string;product?:{media:Array<{assetId:string}>}}};
export type BuyerOrder = {id:string;status:string;currency:string;subtotalMinor:number;
  taxMinor:number;shippingMinor:number;totalMinor:number;createdAt:string;items:BuyerOrderItem[]};
export type BuyerOrdersResponse = {orders:BuyerOrder[]};
export type BuyerOrderResponse = {order:BuyerOrder};
export type CartQuote = {
  items: Array<{
    variantId: string; productId: string; title: string; variantName: string;
    fulfillment: "PHYSICAL" | "DIGITAL"; quantity: number;
    unitPriceMinor: number; lineMinor: number; currency: string; available: boolean;
    selection?:Record<string,string>;
  }>;
  currency: string | null;
  subtotalMinor: number;
  issues: Array<{variantId: string; code: string}>;
  readyForCheckout: false;
  note: string;
};

function requireStoreId(id: string): string {
  if (!storeIdPattern.test(id)) throw new Error("Invalid storefront ID");
  return id;
}

export function storefrontApiPath(storeId: string, suffix: string): string {
  const prefix = `/api/public/stores/${requireStoreId(storeId)}`;
  const permitted = new Set([
    "products", "cart", "checkout/preflight", "orders", "my-digital-purchases", "favorites",
  ]);
  if (!permitted.has(suffix)) throw new Error("Unsupported storefront endpoint");
  return `${prefix}/${suffix}`;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body &&
      typeof body.error === "string" ? body.error : "Store request failed";
    throw new Error(message);
  }
  if (body === null) throw new Error("Unexpected empty response");
  return body as T;
}

export function listStoreProducts(storeId: string, options: {q?: string; page?: number; limit?: number} = {}) {
  const query = new URLSearchParams();
  if (options.q) query.set("q", options.q);
  if (options.page !== undefined) query.set("page", String(options.page));
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  const suffix = query.toString();
  return requestJson<PublicProductsResponse>(storefrontApiPath(storeId, "products") + (suffix ? `?${suffix}` : ""));
}
export function getStoreProduct(storeId: string, slug: string) {
  if (!listingSlugPattern.test(slug)) throw new Error("Invalid listing slug");
  return requestJson<PublicStoreProduct>(`${storefrontApiPath(storeId, "products")}/${slug}`);
}
export type StoreFavoritesResponse = {store:{id:string;slug:string;name:string};favorites:string[];products:PublicStoreProduct[]};
export function listStoreFavorites(storeId:string) {
  return requestJson<StoreFavoritesResponse>(storefrontApiPath(storeId,"favorites"));
}
export function setStoreFavorite(storeId:string,productId:string,enabled:boolean) {
  if (!storeIdPattern.test(productId)) throw new Error("Invalid product ID");
  return requestJson<{productId:string;favorite:boolean}>(storefrontApiPath(storeId,"favorites"),{
    method:enabled?"POST":"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId}),
  });
}
export function getStoreCart(storeId: string) {
  return requestJson<CartQuote>(storefrontApiPath(storeId, "cart"));
}
export async function addStoreVariant(storeId: string, variantId: string, quantity: number) {
  const result = await requestJson<CartQuote>(storefrontApiPath(storeId, "cart"), {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({variantId, quantity}),
  });
  publishCartUpdate();
  return result;
}
export async function setStoreVariantQuantity(storeId: string, variantId: string, quantity: number) {
  const result = await requestJson<CartQuote>(storefrontApiPath(storeId, "cart"), {
    method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({variantId, quantity}),
  });
  publishCartUpdate();
  return result;
}
export function getStoreCheckoutPreflight(storeId: string) {
  // Deliberately read-only. There is no public chargeable checkout in this migration.
  return requestJson<unknown>(storefrontApiPath(storeId, "checkout/preflight"));
}
/** The browser does not choose a merchant: verified domain binding does. */
export function getCurrentStorefront() {
  return requestJson<CurrentStorefront>("/api/public/store-context");
}
export function listStoreOrders(storeId: string) {
  return requestJson<BuyerOrdersResponse>(storefrontApiPath(storeId, "orders"));
}
export function getStoreOrder(storeId: string, orderId: string) {
  if (!storeIdPattern.test(orderId)) throw new Error("Invalid order ID");
  return requestJson<BuyerOrderResponse>(`${storefrontApiPath(storeId, "orders")}/${orderId}`);
}
export type BuyerDigitalGrantFile = {grantId: string; fileId: string; label: string};
export type BuyerDigitalPurchases = {
  orders: Array<{
    orderId: string;
    placedAt: string;
    items: Array<{orderItemId: string; title: string; files: BuyerDigitalGrantFile[]}>;
  }>;
};
export function listStoreDigitalPurchases(storeId: string) {
  return requestJson<BuyerDigitalPurchases>(storefrontApiPath(storeId, "my-digital-purchases"));
}

/** This method never accepts a URL, storage key, session token or filename from the browser.
 * The server resolves the file after validating buyer, host, settled payment and grant.
 */
export async function downloadStoreGrant(storeId: string, grantId: string) {
  const path = `/api/public/stores/${requireStoreId(storeId)}/downloads/${requireStoreId(grantId)}`;
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {"Content-Type": "application/json"},
    body: "{}",
  });
  if (!response.ok) {
    // Preserve the server's deliberate privacy boundary: no storage keys, provider
    // URLs, response HTML or untrusted error bodies are shown to the buyer.
    const safeMessage: Record<number, string> = {
      400: "The download request was rejected. Reload this page and retry (400).",
      401: "Sign in with the purchasing account to download (401).",
      404: "This download is not accessible for this order or account (404).",
      409: "Download access changed. Refresh the order and retry (409).",
      413: "Download request was rejected as too large (413).",
      502: "The purchased private file could not be retrieved from storage (502).",
      503: "The secure download service is temporarily unavailable (503).",
    };
    throw new Error(safeMessage[response.status] ?? `Download failed (${response.status}).`);
  }
  // The server generates a safe filename from the purchased digital file snapshot.
  const disposition = response.headers.get("content-disposition") ?? "";
  const name = /filename="([a-zA-Z0-9._ -]{1,150})"/.exec(disposition)?.[1] ?? "artwork.bin";
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("Empty download response");
  return {blob, filename: name};
}

export function saveStoreGrantDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
