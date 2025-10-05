// src/components/shared/purchase/usePurchaseState.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LicenseOption, MaterialOption, FrameOption } from "../types";
import type { SizeOption } from "@acme/ui/components/product/shared/core/SizeSelectorCore";
import { loadPurchaseState, savePurchaseState } from "../utils/persistence";
import { computeDigitalPrice, computePrintPrice } from "../utils/pricing";


type Catalogs = {
  licenses: LicenseOption[];
  sizes: SizeOption[];
  materials: MaterialOption[];
  frames: FrameOption[];
};

type Defaults = {
  license?: LicenseOption;
  size?: SizeOption;
  material?: MaterialOption;
  frame?: FrameOption | null;
};

type InitialFromCart = {
  digital?: { license?: string | null };
  print?: { size?: string | null; material?: string | null; frame?: string | null };
  // optional: chosen format if you want to persist it too (you can extend)
  format?: string | null;
};

export type PurchaseModel = {
  // availability
  digitalSupported: boolean;
  printSupported: boolean;

  // toggles
  wantDigital: boolean;
  setWantDigital: (v: boolean) => void;
  wantPrint: boolean;
  setWantPrint: (v: boolean) => void;

  // quantity
  qty: number;
  setQty: (n: number) => void;

  // options
  license: LicenseOption;
setLicense: React.Dispatch<React.SetStateAction<LicenseOption>>;
  size: SizeOption;
  setSize: (s: SizeOption) => void;

  isCustom: boolean;
  setIsCustom: (v: boolean) => void;
  customSize: { width: string; height: string };
  setCustomSize: (c: { width: string; height: string }) => void;

  material: MaterialOption;
  setMaterial: (m: MaterialOption) => void;

  frame: FrameOption | null;
  setFrame: (f: FrameOption | null) => void;

  // pricing
  digitalPrice: number;
  printPrice: number;
  finalPrice: number;

  // derived fields commonly needed downstream
  baseVariantFields: {
    format: string; // you can override at callsite if needed
    size: string | null;
    material: string | null;
    frame: string | null;
    license: string; // type
  };

  // utils
  resetToDefaults: () => void;
};

export function usePurchaseState(opts: {
  productId: string;
  designId?: string;                  // for modal; optional on product page
  enabled?: boolean;                  // default: true (modal can pass `open`)
  defaultVariant?: "digital" | "print";
  digitalSupported: boolean;
  printSupported: boolean;
  baseDigitalPrice: number;
  basePrintPrice: number;
  catalogs: Catalogs;
  defaults?: Defaults;
  initialFromCart?: InitialFromCart;  // hydrate from cart before persistence
  defaultFormat?: string;             // used in baseVariantFields
}) : PurchaseModel {
  const {
    productId,
    designId,
    enabled = true,
    defaultVariant = "digital",
    digitalSupported,
    printSupported,
    baseDigitalPrice,
    basePrintPrice,
    catalogs,
    defaults,
    initialFromCart,
    defaultFormat = "png",
  } = opts;

  const { licenses, sizes, materials, frames } = catalogs;

  // initial fallbacks
  const initialLicense = defaults?.license ?? licenses[0];
  const initialSize = defaults?.size ?? sizes[0];
  const initialMaterial = defaults?.material ?? materials[0];
  const initialFrame = (defaults?.frame ?? (frames[0] ?? null)) ?? null;

  const [wantDigital, setWantDigital] = useState<boolean>(digitalSupported && defaultVariant !== "print");
  const [wantPrint, setWantPrint] = useState<boolean>(printSupported && defaultVariant === "print");
  const [qty, setQty] = useState(1);

  const [license, setLicense] = useState<LicenseOption>(initialLicense);
  const [size, setSize] = useState<SizeOption>(initialSize);
  const [isCustom, setIsCustom] = useState((initialSize?.label || "").toLowerCase() === "custom");
  const [customSize, setCustomSize] = useState<{ width: string; height: string }>({ width: "", height: "" });
  const [material, setMaterial] = useState<MaterialOption>(initialMaterial);
  const [frame, setFrame] = useState<FrameOption | null>(initialFrame);

  const didHydrate = useRef(false);
// alert(JSON.stringify(initialSize))
  // Rehydrate from cart (once) then override with persisted (if any)
  useEffect(() => {
    if (!enabled || didHydrate.current) return;

    // 1) Try cart
    if (initialFromCart) {
      const byType = (arr: LicenseOption[], t?: string | null) =>
        arr.find(a => a.type.toLowerCase() === (t || "").toLowerCase());
      const byLabel = <T extends { label: string }>(arr: T[], label?: string | null) =>
        arr.find(a => a.label.toLowerCase() === (label || "").toLowerCase());

      if (initialFromCart.digital?.license) {
        const lic = byType(licenses, initialFromCart.digital.license) ?? initialLicense;
        setLicense(lic);
      }
      if (initialFromCart.print?.size) {
        const sz = byLabel(sizes, initialFromCart.print.size) ?? initialSize;
        
        setSize(sz);
        setIsCustom(sz.label.toLowerCase() === "custom");
      }
      if (initialFromCart.print?.material) {
        const m = byLabel(materials, initialFromCart.print.material) ?? initialMaterial;
        setMaterial(m);
      }
      if (typeof initialFromCart.print?.frame !== "undefined") {
        const f = initialFromCart.print.frame
          ? (byLabel(frames, initialFromCart.print.frame) ?? null)
          : null;
        setFrame(f);
      }
    }

    // 2) Try persistence
    const persisted = loadPurchaseState(productId, designId);
    if (persisted) {
      const byType = (arr: LicenseOption[], t?: string) =>
        arr.find(a => a.type.toLowerCase() === (t || "").toLowerCase());
      const byLabel = <T extends { label: string }>(arr: T[], label?: string | null) =>
        arr.find(a => a.label.toLowerCase() === (label || "").toLowerCase());

      setWantDigital(Boolean(persisted.wantDigital) && digitalSupported);
      setWantPrint(Boolean(persisted.wantPrint) && printSupported);
      setQty(Math.max(1, Number(persisted.qty) || 1));

      setLicense(byType(licenses, persisted.licenseType) ?? initialLicense);

      const sz = byLabel(sizes, persisted.sizeLabel) ?? initialSize;
      setSize(sz);
      setIsCustom(Boolean(persisted.isCustom));
      setCustomSize(persisted.customSize || { width: "", height: "" });

      setMaterial(byLabel(materials, persisted.materialLabel) ?? initialMaterial);
      setFrame(persisted.frameLabel ? (byLabel(frames, persisted.frameLabel) ?? null) : null);
    }

    didHydrate.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, productId, designId]);

  // Persist (debounced) whenever enabled + any relevant value changes
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      savePurchaseState(productId, designId, {
        wantDigital, wantPrint, qty,
        licenseType: license.type,
        sizeLabel: size.label,
        isCustom,
        customSize,
        materialLabel: material.label,
        frameLabel: frame?.label ?? null,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [
    enabled,
    productId, designId,
    wantDigital, wantPrint, qty,
    license.type, size?.label, isCustom, customSize, material.label, frame
  ]);

  const digitalPrice = useMemo(
    () => computeDigitalPrice(baseDigitalPrice, license),
    [baseDigitalPrice, license]
  );
  // alert(digitalPrice)
  const printPrice = useMemo(
    () => computePrintPrice(basePrintPrice, size, material, frame),
    [basePrintPrice, size, material, frame]
  );
  const finalPrice = useMemo(
    () => (wantDigital ? digitalPrice : 0) + (wantPrint ? printPrice : 0),
    [wantDigital, wantPrint, digitalPrice, printPrice]
  );

  const baseVariantFields = useMemo(() => ({
    format: defaultFormat,
    size: wantPrint ? size?.label : null,
    material: wantPrint ? material.label : null,
    frame: wantPrint ? (frame?.label ?? null) : null,
    license: wantDigital ? license.type : license.type, // snapshot
  }), [defaultFormat, wantPrint, size?.label, material.label, frame, wantDigital, license.type]);

  const resetToDefaults = () => {
    setWantDigital(digitalSupported && defaultVariant !== "print");
    setWantPrint(printSupported && defaultVariant === "print");
    setQty(1);
    setLicense(initialLicense);
    setSize(initialSize);
    setIsCustom((initialSize.label || "").toLowerCase() === "custom");
    setCustomSize({ width: "", height: "" });
    setMaterial(initialMaterial);
    setFrame(initialFrame);
  };

  return {
    digitalSupported,
    printSupported,
    wantDigital, setWantDigital,
    wantPrint, setWantPrint,
    qty, setQty,
    license, setLicense,
    size, setSize,
    isCustom, setIsCustom,
    customSize, setCustomSize,
    material, setMaterial,
    frame, setFrame,
    digitalPrice, printPrice, finalPrice,
    baseVariantFields,
    resetToDefaults,
  };
}
