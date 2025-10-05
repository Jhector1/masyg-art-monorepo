import { allFrames, allLicenses, allMaterials } from "../data/helpers";
import { areaInSqIn, getSizeMultiplier, RATE_PER_SQIN, SizeMathOptions } from "../utils/helpers";
// import { number } from "zod";

// lib/pricing.ts
export type SaleFields = {
  price: number;
  salePrice?: number | null;
  salePercent?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
};

export function getEffectiveSale(p: SaleFields, now = new Date()) {
  const active =
    (!p.saleStartsAt || p.saleStartsAt <= now) &&
    (!p.saleEndsAt || p.saleEndsAt > now);

  if (!active)
    return {
      price: p.price,
      compareAt: null as number | null,
      onSale: false,
      endsAt: null as Date | null,
    };

  // salePrice wins if present; otherwise compute by percent
  if (p.salePrice != null) {
    const price = Math.max(0, +p.salePrice.toFixed(2));
    return {
      price,
      compareAt: p.price,
      onSale: price < p.price,
      endsAt: p.saleEndsAt ?? null,
    };
  }

  if (p.salePercent != null) {
    const price = Math.max(
      0,
      +(p.price * (1 - p.salePercent / 100)).toFixed(2)
    );
    return {
      price,
      compareAt: price < p.price ? p.price : null,
      onSale: price < p.price,
      endsAt: p.saleEndsAt ?? null,
    };
  }

  return { price: p.price, compareAt: null, onSale: false, endsAt: null };
}

/**
 * Compute your *base* unit price from selection (before sale).
 * Replace the multipliers with your real logic or import from your data.
 */
// src/lib/pricing.ts (or same file you’re editing)
// import { allMaterials, allFrames, allLicenses, allSizes } from "@/pricing/tables";

const round2 = (n: number) => Math.max(0, Math.round(n * 100) / 100);

export function computeBaseUnit(args: {
  productBase: number;
  format?: string | null;
  size?: string | null;
  material?: string | null;
  frame?: string | null;
  license?: string | null;
  digital?: any;
  print?: any;

  // still accepted; we just won’t use size multiplier anymore
  sizeList?: string[];
  sizeOptions?: SizeMathOptions;
}): number {
  const {
    productBase,
    size = null,
    material = null,
    frame = null,
    license = null,
    digital = null,
    print = null,
  } = args;

  const isDigital = !!digital;
  const isPrint = !!print;

  // License adder still applies to digital
  const licenseAdd = allLicenses.find((l) => l.type === license)?.price ?? 0;

  // Material/frame multipliers still apply
  const materialMult = allMaterials.find((m) => m.label === material)?.multiplier ?? 1;
  const frameMult    = allFrames.find((f) => f.label === frame)?.multiplier ?? 1;

  // --- Digital ---
  let digitalPrice = 0;
  if (isDigital) {
    digitalPrice = productBase + licenseAdd;
  }

  // --- Print (size additive, NOT a multiplier) ---
  let printPrice = 0;
  if (isPrint) {
    // parse area from size string like `12" x 12"`
    const area = typeof size === "string" && size ? areaInSqIn(size) : 0;
    const sizeAmount = area * RATE_PER_SQIN; // additive
    printPrice = (productBase + sizeAmount) * materialMult * frameMult;
  }

  const total = digitalPrice + printPrice;
  return Math.max(0, Math.round(total * 100) / 100);
}




// const BUNDLE_BOTH_PERCENT = 20;

// after
export const roundMoney = (v: number) => {
  const sign = v < 0 ? -1 : 1;
  const n = Math.abs(v);
  return (Math.round((n + Number.EPSILON) * 100) / 100) * sign;
};/** 20% off if BOTH are present. Accepts booleans or objects. */
export function applyBundleIfBoth(
  base: number,
  digital?: unknown,
  print?: unknown,
  pct = 0.20
) {
  const wantDigital = Boolean(digital);
  const wantPrint   = Boolean(print);
  return wantDigital && wantPrint ? base * (1 - pct) : base;
}


// function finalWithBestOf({
//   baseUnit,
//   salePrice,
//   hasDigital,
//   hasPrint,
// }: {
//   baseUnit: number;
//   salePrice: number;
//   hasDigital: unknown;
//   hasPrint: unknown;
// }) {
//   const bundleEligible = Boolean(hasDigital && hasPrint);
//   const bundlePrice = bundleEligible
//     ? roundMoney(baseUnit * (1 - BUNDLE_PERCENT / 100))
//     : null;

//   let price = salePrice;
//   let applied: "sale" | "bundle" = "sale";
//   if (bundlePrice !== null && bundlePrice < price) {
//     price = bundlePrice;
//     applied = "bundle";
//   }
//   return { price, applied };
// }
