/**
 * Read-only print-option view model: every choice corresponds to ONE published SKU.
 * No cart mutations, stock math, guessed combinations or browser-derived prices.
 */
import type { PublicVariant } from "./public-catalog-view";
import {formatCatalogPrice} from "./public-catalog-view";
import {
  isPublicPrintVariant, publicPrintSize, publicPrintVariantLabel,
  sortedPublicPrintVariants,
} from "./public-print-variants";

export type PublicPrintChoice = Readonly<{
  variantId: string;
  label: string;
  sizeLabel: string | null;
  priceLabel: string;
  available: boolean;
}>;

/**
 * Show each real print variant individually, including sold-out variants.
 * This avoids fabricating prices or inventories for a size × frame combination.
 */
export function publicPrintChoices(variants: readonly PublicVariant[]): PublicPrintChoice[] {
  const prints = sortedPublicPrintVariants(variants).filter(isPublicPrintVariant);
  const baseLabels = prints.map(publicPrintVariantLabel);
  const counts = new Map<string, number>();
  for (const label of baseLabels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const used = new Map<string, number>();
  return prints.map((variant, index) => {
    const base = baseLabels[index];
    // If two published editions share all display attributes, still distinguish
    // them rather than silently collapsing distinct inventory-bearing SKUs.
    const occurrence = (used.get(base) ?? 0) + 1;
    used.set(base, occurrence);
    const label = (counts.get(base) ?? 0) > 1 ? `${base} · Edition ${occurrence}` : base;
    return {
      variantId: variant.id,
      label,
      sizeLabel: publicPrintSize(variant)?.label ?? null,
      priceLabel: formatCatalogPrice(variant.priceMinor, variant.currency),
      available: variant.available,
    };
  });
}

/** A buyer can select only an active, available published print variant. */
export function availablePublicPrintChoice(
  variants: readonly PublicVariant[], variantId: string,
): PublicVariant | null {
  return variants.find(variant => variant.id === variantId &&
    isPublicPrintVariant(variant) && variant.available) ?? null;
}
