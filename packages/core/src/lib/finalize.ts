// Compose the exact same pipeline your API uses:
// computeBaseUnit → getEffectiveSale → applyBundleIfBoth → round(min)

import {
  computeBaseUnit,
  getEffectiveSale,
  applyBundleIfBoth,
  roundMoney,
} from "./pricing";

// ↓ Define lightweight shapes locally (no need to export from @/lib/pricing)
type LightDigitalVariant = {
  type: "DIGITAL";
  format?: string | null;
  license?: string | null;
};

type LightPrintVariant = {
  type: "PRINT";
  format?: string | null;
  size?: string | null;
  material?: string | null;
  frame?: string | null;
};

export type FinalizePriceInput = {
  // DB/base fields
  productBase: number;
  salePrice?: number | null;
  salePercent?: number | null;
  saleStartsAt?: Date  | null;
  saleEndsAt?: Date  | null;

  // current selection
  format?: string | null;
  size?: string | null;
  material?: string | null;
  frame?: string | null;
  license?: string | null;
  digital?: LightDigitalVariant | null;
  print?: LightPrintVariant | null;

  // for size multiplier lookups / parsing
  sizeList?:
   string[]
};

export function computeFinalUnitPrice(input: FinalizePriceInput) {
  const baseUnit = computeBaseUnit({
    productBase: input.productBase,
    format: input.format,
    size: input.size,
    material: input.material,
    frame: input.frame,
    license: input.license,
    digital: input.digital ?? null,
    print: input.print ?? null,
    sizeList: input.sizeList,
  });

  const { price: priceWithSale } = getEffectiveSale({
    price: baseUnit,
    salePrice: input.salePrice ?? null,
    salePercent: input.salePercent ?? null,
    saleStartsAt: input.saleStartsAt ?? null,
    saleEndsAt: input.saleEndsAt ?? null,
  });

  const priceWithBundle = applyBundleIfBoth(
    baseUnit,
    input.digital,
    input.print
  );
  const finalUnitPrice = roundMoney(Math.min(priceWithSale, priceWithBundle));

  return { baseUnit, priceWithSale, priceWithBundle, finalUnitPrice };
}
