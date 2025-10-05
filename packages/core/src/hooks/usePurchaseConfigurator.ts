// src/hooks/usePurchaseConfigurator.ts
import { useMemo, useState, useCallback } from "react";
import type {
  ProductDetailResult,
  LicenseOption,
  MaterialOption,
  FrameOption,
  CartSelectedItem,
  CartUpdates,
  AddOptions,
} from "../types";
import type { SizeOption } from "@acme/ui/components/product/shared/core/SizeSelectorCore";
import { computeFinalUnitPrice } from "../lib/finalize"; // unified client/server pricing
import { toDate } from "../utils/helpers";

export function usePurchaseConfigurator(args: {
  product: ProductDetailResult;

  wantDigital: boolean;
  setWantDigital: (v: boolean) => void;
  wantPrint: boolean;
  setWantPrint: (v: boolean) => void;

  license: LicenseOption;
  setLicense: React.Dispatch<React.SetStateAction<LicenseOption>>;

  size: SizeOption;
  setSize: (s: SizeOption) => void;
  customSize: { width: string; height: string };
  setCustomSize: (c: { width: string; height: string }) => void;
  isCustom: boolean;
  setIsCustom: (v: boolean) => void;

  material: MaterialOption;
  setMaterial: (m: MaterialOption) => void;

  frame: FrameOption | null;
  setFrame: (f: FrameOption | null) => void;

  inCart?: CartSelectedItem | null;
  updateCart?: (input: {
    productId: string;
    digitalVariantId?: string | "ADD" | "REMOVE";
    printVariantId?: string | "ADD" | "REMOVE";
    updates: CartUpdates;
  }) => Promise<any> | void;

  options: AddOptions;
  setOptions: React.Dispatch<React.SetStateAction<AddOptions>>;
}) {
  const {
    product, wantDigital, setWantDigital, wantPrint, setWantPrint,
    license, setLicense, size, setSize, customSize, setCustomSize, isCustom, setIsCustom,
    material, setMaterial, frame, setFrame,
    inCart, updateCart, options, setOptions,
  } = args;
const saleStartsAt = toDate(product?.saleStartsAt as any);
const saleEndsAt   = toDate(product?.saleEndsAt as any);
  // Available formats
  const formats = useMemo(() => {
    const seen = new Set<string>();
    return (product?.formats ?? [])
      .map((url) => (url?.split(".").pop() ?? "").toLowerCase())
      .filter((ext) => ext && !seen.has(ext) && (seen.add(ext), true))
      .map((ext) => ({ type: ext, resolution: "n/a", multiplier: 1 }));
  }, [product?.formats]);

  const [format, setFormat] = useState<string>(formats[0]?.type || "");

  // Normalized size string (supports custom)
  const sizeString = useMemo(() => {
    if (!wantPrint) return null;
    if (!isCustom) return size?.label ?? null;
    const w = parseFloat(customSize.width || "");
    const h = parseFloat(customSize.height || "");
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? `${w}x${h} in`
      : size?.label ?? null;
  }, [wantPrint, isCustom, customSize, size?.label]);

  // Per-option unit prices using the same pipeline as the API
  const digitalUnit = useMemo(() => {
    if (!wantDigital) return { finalUnitPrice: 0 };
    return computeFinalUnitPrice({
      productBase: product.price,
      salePrice: product.salePrice,
      salePercent: product.salePercent,
      saleStartsAt,
      saleEndsAt,
      format,
      license: license.type,
      digital: { type: "DIGITAL", format, license: license.type },
      print: null,
      sizeList: product.sizes,
    });
  }, [wantDigital, product, format, license.type]);

  const printUnit = useMemo(() => {
    if (!wantPrint) return { finalUnitPrice: 0 };
    return computeFinalUnitPrice({
      productBase: product.price,
      salePrice: product.salePrice,
      salePercent: product.salePercent,
      saleStartsAt,
      saleEndsAt,
      format,
      size: sizeString,
      material: material.label,
      frame: frame?.label ?? null,
      digital: null,
      print: { type: "PRINT", format, size: sizeString, material: material.label, frame: frame?.label ?? null },
      sizeList: product.sizes,
    });
  }, [wantPrint, product, format, sizeString, material.label, frame?.label]);

  const digitalPriceNum = Number(digitalUnit.finalUnitPrice) || 0;
  const printPriceNum   = Number(printUnit.finalUnitPrice) || 0;
  const digitalPriceStr = digitalPriceNum.toFixed(2);
  const printPriceStr   = printPriceNum.toFixed(2);

  // Toggle DIGITAL — no client price in updates
  const handleToggleDigital = useCallback(async () => {
    const turningOn = !wantDigital;
    setWantDigital(turningOn);
    setOptions((o) => ({ ...o, digital: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        digitalVariantId: "ADD",
        updates: { format: format || "jpg", license: license.type } as CartUpdates,
      });
      if (res?.digitalVariantId) {
        setOptions((o) => ({ ...o, digitalVariantId: res.digitalVariantId }));
      }
    } else {
      const res = await updateCart({
        productId: product.id,
        digitalVariantId: "REMOVE",
        updates: {},
      });
      if (res?.digitalVariantId === null) {
        setOptions((o) => ({ ...o, digitalVariantId: "" }));
      }
    }
  }, [wantDigital, setWantDigital, setOptions, inCart, updateCart, product?.id, format, license?.type]);

  // Toggle PRINT — no client price in updates
  const handleTogglePrint = useCallback(async () => {
    const turningOn = !wantPrint;
    setWantPrint(turningOn);
    setOptions((o) => ({ ...o, print: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        printVariantId: "ADD",
        updates: {
          format: "jpg",
          size: size.label,
          material: material.label,
          frame: frame?.label ?? null,
        } as CartUpdates,
      });
      if (res?.printVariantId) {
        setOptions((o) => ({ ...o, printVariantId: res.printVariantId }));
      }
    } else {
      const res = await updateCart({
        productId: product.id,
        printVariantId: "REMOVE",
        updates: {},
      });
      if (res?.printVariantId === null) {
        setOptions((o) => ({ ...o, printVariantId: "" }));
      }
    }
  }, [wantPrint, setWantPrint, setOptions, inCart, updateCart, product?.id, size?.label, material?.label, frame]);

  // Field updaters — never send price
  const handleFormatChange = useCallback(async (nextFormat: string) => {
    setFormat(nextFormat);
    if (!inCart || !updateCart) return;

    if (options.print && options.printVariantId) {
      await updateCart({
        productId: product.id,
        printVariantId: options.printVariantId!,
        updates: { format: nextFormat } as CartUpdates,
      });
    }
    if (options.digital && options.digitalVariantId) {
      await updateCart({
        productId: product.id,
        digitalVariantId: options.digitalVariantId!,
        updates: { format: nextFormat } as CartUpdates,
      });
    }
  }, [inCart, updateCart, options.print, options.printVariantId, options.digital, options.digitalVariantId, product?.id]);

  const handleLicenseSelect = useCallback(async (lic: LicenseOption) => {
    setLicense(lic);
    if (!inCart || !updateCart || !options.digital) return;
    const res = await updateCart({
      productId: product.id,
      digitalVariantId: options.digitalVariantId || "ADD",
      updates: { license: lic.type, format } as CartUpdates,
    });
    if (res?.digitalVariantId && !options.digitalVariantId) {
      setOptions((o) => ({ ...o, digitalVariantId: res.digitalVariantId }));
    }
  }, [inCart, updateCart, options.digital, options.digitalVariantId, product?.id, setLicense, format, setOptions]);

  const handleSizeSelect = useCallback(async (sel: SizeOption) => {
    setSize(sel);
    setIsCustom(sel.label === "Custom");
    if (!inCart || !updateCart || !options.print || !options.printVariantId) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId!,
      updates: { size: sel.label } as CartUpdates,
    });
  }, [setSize, setIsCustom, inCart, updateCart, options.print, options.printVariantId, product?.id]);

  const handleCustomSizeChange = useCallback(async (c: { width: string; height: string }) => {
    setCustomSize(c);
    if (!inCart || !updateCart || !options.print || !options.printVariantId) return;
    const w = parseFloat(c.width || "");
    const h = parseFloat(c.height || "");
    const label = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? `${w}x${h} in` : null;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId!,
      updates: { size: label } as CartUpdates,
    });
  }, [setCustomSize, inCart, updateCart, options.print, options.printVariantId, product?.id]);

  const handleMaterial = useCallback(async (m: MaterialOption) => {
    setMaterial(m);
    if (!inCart || !updateCart || !options.print || !options.printVariantId) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId!,
      updates: { material: m.label } as CartUpdates,
    });
  }, [setMaterial, inCart, updateCart, options.print, options.printVariantId, product?.id]);

  const handleFrame = useCallback(async (f: FrameOption | null) => {
    setFrame(f);
    if (!inCart || !updateCart || !options.print || !options.printVariantId) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId!,
      updates: { frame: f?.label ?? null } as CartUpdates,
    });
  }, [setFrame, inCart, updateCart, options.print, options.printVariantId, product?.id]);

  return {
    formats, format, setFormat,
    digitalPriceStr, printPriceStr,
    digitalPriceNum, printPriceNum,
    handleToggleDigital, handleTogglePrint,
    handleFormatChange, handleLicenseSelect,
    handleSizeSelect, handleCustomSizeChange,
    handleMaterial, handleFrame,
  };
}
