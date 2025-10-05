"use client";

import type { SizeOption } from "../../product/shared/core/SizeSelectorCore";
import type { LicenseOption, MaterialOption, FrameOption } from "@acme/core/types";
import { useProductPurchase } from "./useUnifiedPurchaseFlow";

export function useProductData({ productId }: { productId: string }) {
  const p = useProductPurchase({ productId });

  // Toggle-aware wrappers to match (v:boolean)=>void shape
  const setWantDigital = (v: boolean) => {
    if (Boolean(v) !== Boolean(p.wantDigital)) p.setWantDigital();
  };
  const setWantPrint = (v: boolean) => {
    if (Boolean(v) !== Boolean(p.wantPrint)) p.setWantPrint();
  };

  // Value-or-updater adapters
  const wrapSet =
    <T,>(current: T, apply: (next: T) => void) =>
    (nextOrFn: T | ((prev: T) => T)) => {
      const next =
        typeof nextOrFn === "function"
          ? (nextOrFn as (prev: T) => T)(current)
          : (nextOrFn as T);
      apply(next);
    };

  const setLicense   = wrapSet(p.license as LicenseOption, p.setLicense);
  const setSize      = wrapSet(p.size as SizeOption, p.setSize);
  const setCustomSize= wrapSet(p.customSize, p.setCustomSize);
  const setIsCustom  = wrapSet(p.isCustom, p.setIsCustom);
  const setMaterial  = wrapSet(p.material as MaterialOption, p.setMaterial);
  const setFrame     = wrapSet(p.frame as FrameOption | null, p.setFrame);

  return {
    // data + cart
    product: p.product,
    inCart: p.inCart,
    loadingAdd: p.loadingAdd,
    addToCart: p.addToCart,
    removeFromCart: p.removeFromCart,
    updateCart: p.updateCart,

    // media
    preview: p.preview,
    setPreview: p.setPreview,

    // selections
    options: p.options,
    setOptions: p.setOptions,
    size: p.size as SizeOption,
    setSize,
    customSize: p.customSize,
    setCustomSize,
    isCustom: p.isCustom,
    setIsCustom,
    material: p.material as MaterialOption,
    setMaterial,
    frame: p.frame as FrameOption | null,
    setFrame,
    license: p.license as LicenseOption,
    setLicense,
    wantDigital: p.wantDigital,
    setWantDigital,
    wantPrint: p.wantPrint,
    setWantPrint,
    format: p.format,
    setFormat: p.setFormat,

    // pricing (unit)
    finalPrice: p.finalPrice,
    baseUnit: p.baseUnit,
    priceWithSale: p.priceWithSale,
    priceWithBundle: p.priceWithBundle,

    // checkout
    handleCheckoutAction: p.handleCheckoutAction,
  };
}
