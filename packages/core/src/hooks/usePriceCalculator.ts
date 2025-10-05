// File: src/hooks/usePriceCalculator.ts
import { ProductDetailResult } from "../types";

export interface PriceOptionsProps {
  digitalPrice: string;
  printPrice:   string;
}

/*───────────────────────────────────────────────────────────────────────────*/

export function usePriceCalculator(
  product:    ProductDetailResult,
  size:       { label: string; multiplier: number },
  material:   { multiplier: number },
  frame:      { multiplier: number } | null,
  options:    { digital: boolean , print: boolean },
  customSize: { width: string; height: string },
  isCustom:   boolean,
  license:    { price: number }
) {
  /** accept 0 – 10 as “sane” multipliers; otherwise fall back */
  const safe    = (n: number | undefined) =>
    Number.isFinite(n) && n! >= 0 && n! <= 10 ? n! : undefined;

  /** tidy helper for digital formatting rules */
  const fmtDigital = (total: number, lic: number) =>
    lic < 0 || !Number.isInteger(total)
      ? total.toFixed(2)          // negative or fractional → keep 2 dp
      : String(total);            // positive integer → bare integer

  return (
    type: "Digital" | "Print",
    eraser: "material" | "frame" | "size" | "license" | "" = "",
    newMultiplier = 0
  ): PriceOptionsProps => {
    /*─────────────── 0. Baseline values ───────────────*/
    const base      = product?.price ?? 0;

    let sizeMult    = size?.multiplier;
    let matMult     = material?.multiplier ?? 1;
    let frameMult   = frame?.multiplier   ?? 1;
    let licPrice    = license.price;

    /*─────────────── 1. Custom-size override ──────────*/
    if (isCustom) {
      const w = parseFloat(customSize.width  ?? "");
      const h = parseFloat(customSize.height ?? "");
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        sizeMult = (w * h) / 80;           // 8 × 10 baseline
      }
    }

    /*─────────────── 2. Eraser overrides ──────────────*/
    const valid     = safe(newMultiplier);
    switch (eraser) {
      case "size":
        sizeMult  = valid ?? sizeMult;
        break;
      case "material":
        matMult   = valid ?? matMult;
        break;
      case "frame":
        frameMult = valid ?? frameMult;
        break;
      case "license":
        licPrice  = newMultiplier;
        break;                              // licence can be any number
      default:
        /* ignore unknown eraser types */
    }

    /*─────────────── 3. DIGITAL-ONLY branch ───────────*/
    if (type.toLowerCase() === "digital") {
      const total = base + licPrice;
      return {
        digitalPrice: fmtDigital(total, licPrice),
        printPrice:   "0.00",
      };
    }

    /*─────────────── 4. PRINT branch ──────────────────*/
    const rawPrint   = base * sizeMult * matMult * frameMult;

    // 🚩 **Spec wants “banker-style” rounding to the nearest dollar
    //     *then* 2 dp** – this is what makes 49.982… → 50.00.
    const printRounded = Math.round(rawPrint);        // nearest whole
    const digitalTotal = base + licPrice;

    return {
      printPrice:   printRounded.toFixed(2),           // always 2 dp
      digitalPrice: (digitalTotal).toFixed(2),         // always 2 dp in Print mode
    };
  };
}
