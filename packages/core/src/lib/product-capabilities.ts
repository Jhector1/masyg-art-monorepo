/** Category presentation must be derived from published metadata, not deleted Product.kind. */
export type DisplayKind = "ART" | "BOOK_DIGITAL" | "STICKER" | "MUG" | "CARD" | "OTHER";
type Variant = {fulfillment: "PHYSICAL" | "DIGITAL"; attributes?: unknown; active?: boolean};
type Detail = {category?: string | null; variants?: readonly Variant[]};
const supported = new Set<DisplayKind>(["ART", "BOOK_DIGITAL", "STICKER", "MUG", "CARD", "OTHER"]);
export function getDisplayKind(product: Detail | null | undefined): DisplayKind {
  if (!product) return "OTHER";
  for (const v of product.variants ?? []) {
    const attrs = v.attributes;
    if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) continue;
    const record = attrs as Record<string, unknown>;
    for (const field of [record.productKind, record.kind]) {
      if (typeof field === "string" && supported.has(field.toUpperCase() as DisplayKind)) {
        return field.toUpperCase() as DisplayKind;
      }
    }
  }
  const category = product.category?.trim().toUpperCase();
  return category && supported.has(category as DisplayKind) ? category as DisplayKind : "OTHER";
}

export function getFulfillmentCapabilities(product: Detail | null | undefined) {
  const variants = (product?.variants ?? []).filter(v => v.active !== false);
  return {
    supportsDigital: variants.some(v => v.fulfillment === "DIGITAL"),
    supportsPrint: variants.some(v => v.fulfillment === "PHYSICAL"),
  };
}

export function getVariantStringAttribute(variant: {attributes?: unknown} | null | undefined, key: string): string | null {
  const raw = variant?.attributes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length <= 160 ? value : null;
}
