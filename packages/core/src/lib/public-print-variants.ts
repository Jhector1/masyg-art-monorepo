/**
 * Public art-print selection contract. This module only interprets variants
 * already returned from the published, tenant-scoped catalog; it never prices
 * goods, constructs inventory, changes publication or authorizes a purchase.
 */
import type { PublicVariant } from "./public-catalog-view";

export type PublicPrintSize = Readonly<{
  width: number;
  height: number;
  unit: "in" | "cm";
  label: string;
  areaCm2: number;
}>;

/** A size attribute alone does NOT make coffee, shirts or other goods a print. */
export function isPublicPrintVariant(variant: PublicVariant): boolean {
  return variant.fulfillment === "PHYSICAL" && variant.offeringKind === "PRINT";
}

function attributes(variant: PublicVariant): Record<string, unknown> {
  const raw = variant.attributes;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
}

function shortText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/gu, " ");
  return trimmed && trimmed.length <= 100 && !/[\x00-\x1f\x7f]/u.test(trimmed) ? trimmed : null;
}

/** No unit conversions are guessed; conversions are only for display ordering. */
export function publicPrintSize(variant: PublicVariant): PublicPrintSize | null {
  if (!isPublicPrintVariant(variant)) return null;
  const label = shortText(attributes(variant).size);
  if (!label) return null;
  const match = /^(\d+(?:\.\d{1,3})?)\s*[x×]\s*(\d+(?:\.\d{1,3})?)\s*(in|inch|inches|cm)$/iu.exec(label);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  const unit = match[3].toLowerCase().startsWith("in") ? "in" : "cm";
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
    width > 10000 || height > 10000) return null;
  const factor = unit === "in" ? 2.54 : 1;
  return {width, height, unit, label, areaCm2: width * height * factor * factor};
}

/** Display an actual priced SKU; never present a fabricated size/price combo. */
export function publicPrintVariantLabel(variant: PublicVariant): string {
  if (!isPublicPrintVariant(variant)) return variant.name;
  const details = attributes(variant);
  const size = publicPrintSize(variant)?.label;
  const suffix = (["material", "finish", "frame", "glazing"] as const)
    .map(key => shortText(details[key]))
    .filter((value): value is string => value !== null)
    .filter(value => !["none", "unframed"].includes(value.toLowerCase()));
  return [size ?? shortText(variant.name) ?? "Print edition", ...suffix].join(" · ");
}

/** Preserve the position of other goods, sorting actual prints by physical size. */
export function sortedPublicPrintVariants(variants: readonly PublicVariant[]): PublicVariant[] {
  const prints = variants.filter(isPublicPrintVariant).sort((left, right) => {
    const a = publicPrintSize(left)?.areaCm2 ?? Number.POSITIVE_INFINITY;
    const b = publicPrintSize(right)?.areaCm2 ?? Number.POSITIVE_INFINITY;
    return a - b || left.id.localeCompare(right.id);
  });
  let i = 0;
  return variants.map(variant => isPublicPrintVariant(variant) ? prints[i++] : variant);
}

/** The browser may request only the selected, currently available public SKU. */
export function availablePublicVariantById(
  variants: readonly PublicVariant[], selectedId: string,
): PublicVariant | null {
  return variants.find(variant => variant.id === selectedId && variant.available) ?? null;
}
