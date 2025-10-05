// src/components/shared/purchase/pricing.ts
import type { LicenseOption, MaterialOption, FrameOption } from "../types";
import type { SizeOption } from "@acme/ui/components/product/shared/core/SizeSelectorCore";
import { areaInSqIn, RATE_PER_SQIN } from "./helpers";

export function computeDigitalPrice(baseDigitalPrice: number, lic: LicenseOption) {
  const base = Number(baseDigitalPrice) || 0;
  const extra = Number(lic?.price ?? 0) || 0;
  const val = base + extra;
  return Number.isFinite(val) ? Math.max(0, val) : 0;
}


// Print price: (base + sizeAmount) * material * frame
// sizeAmount is additive: area * RATE_PER_SQIN  (NO size multiplier)
export function computePrintPrice(
  basePrintPrice: number,
  size: SizeOption,
  material: MaterialOption,
  frame: FrameOption | null
) {
  const base = Number(basePrintPrice) || 0;

  // try to read a human label like `12" x 12"`; fall back to multiplier only if needed
  const sizeLabel =
    (size as any)?.label ??
    (size as any)?.value ??
    (size as any)?.name ??
    "";

  // area in square inches (0 if not parseable)
  const area =
    typeof sizeLabel === "string" && sizeLabel
      ? areaInSqIn(sizeLabel)
      : 0;

  // additive size amount: NO size multiplier
  const sizeAmount = area * RATE_PER_SQIN;

  const mm = Math.max(1, Number(material?.multiplier ?? 1));
  const fm = Math.max(1, Number(frame?.multiplier ?? 1));

  const val = (base + sizeAmount) * mm * fm;
  return Number.isFinite(val) ? Math.max(0, Math.round(val * 100) / 100) : 0;
}

