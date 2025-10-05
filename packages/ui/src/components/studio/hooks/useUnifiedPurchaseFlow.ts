"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useUser } from "@acme/core/contexts/UserContext";
import { useCart } from "@acme/core/contexts/CartContext";
import { fetchProductById } from "@acme/core/utils/fetchProductById";
import { handleCheckout } from "@acme/core/utils/handleCheckout";
import { cleanSizes, toDate } from "@acme/core/utils/helpers";
import { allFrames, allLicenses, allMaterials } from "@acme/core/data/helpers";
import { computeFinalUnitPrice } from "@acme/core/lib/finalize";

import type {
  AddOptions,
  CartSelectedItem,
  CartUpdates,
  ProductDetailResult,
  LicenseOption,
  MaterialOption,
  FrameOption,
} from "@acme/core/types";
import type { SizeOption } from "../../product/shared/core/SizeSelectorCore";

const uniqFormats = (urls: string[] = []) => {
  const seen = new Set<string>();
  return urls
    .map((u) => (u?.split(".").pop() ?? "").toLowerCase())
    .filter((ext) => ext && !seen.has(ext) && seen.add(ext));
};

export function useProductPurchase({ productId }: { productId: string }) {
  const { user, guestId } = useUser();
  const { cart, loadingAdd, addToCart, updateCart, removeFromCart } = useCart();

  // product + media
  const [product, setProduct] = useState<ProductDetailResult | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);

  // normalized catalog bits
  const [allSizes, setAllSizes] = useState<SizeOption[]>([]);

  // on/off + variant ids you already persist in cart
  const [options, setOptions] = useState<AddOptions>({
    digital: false,
    print: false,
    digitalVariantId: "",
    printVariantId: "",
  });

  // single source of truth for selections
  const [wantDigital, setWantDigital] = useState(false);
  const [wantPrint, setWantPrint] = useState(false);
  const [license, setLicense] = useState<LicenseOption>(allLicenses[0]);
  const [size, setSize] = useState<SizeOption | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customSize, setCustomSize] = useState<{ width: string; height: string }>({
    width: "",
    height: "",
  });
  const [material, setMaterial] = useState<MaterialOption>(allMaterials[0]);
  const [frame, setFrame] = useState<FrameOption | null>(null);
  const [format, setFormat] = useState<string>("");

  // ── load product + seed from cart once ─────────────────────────────
  useEffect(() => {
    if (!productId) return;

    fetchProductById(productId, user?.id || guestId || "")
      .then((p) => {
        setProduct(p);
        setPreview({ src: p.imageUrl || "", alt: p.title });
        setAllSizes(cleanSizes(p.sizes));

        // formats
        const fmts = uniqFormats(p.formats);
        setFormat(fmts[0] || "png");

        // in-cart flags
        const printVariant = p.variants?.find(
          (v) => v.type?.toUpperCase() === "PRINT" && v.inUserCart
        );
        const digitalVariant = p.variants?.find(
          (v) => v.type?.toUpperCase() === "DIGITAL" && v.inUserCart
        );

        setOptions({
          digital: !!digitalVariant,
          print: !!printVariant,
          digitalVariantId: digitalVariant?.id || "",
          printVariantId: printVariant?.id || "",
        });

        setWantDigital(!!digitalVariant);
        setWantPrint(!!printVariant);

        // hydrate selections from cart snapshot (if present)
        const byType = (t?: string | null) =>
          allLicenses.find((l) => l.type.toLowerCase() === (t || "").toLowerCase());
        const byLabel = <T extends { label: string }>(arr: T[], lbl?: string | null) =>
          arr.find((a) => a.label.toLowerCase() === (lbl || "").toLowerCase());

        if (digitalVariant?.license) {
          const lic = byType(digitalVariant.license);
          if (lic) setLicense(lic);
        }
        if (printVariant?.size) {
          const sz = byLabel(cleanSizes(p.sizes), printVariant.size);
          if (sz) {
            setSize(sz);
            setIsCustom(sz.label.toLowerCase() === "custom");
          }
        } else {
          // default size if available
          const first = cleanSizes(p.sizes)[0];
          if (first) setSize(first);
        }
        if (printVariant?.material) {
          const m = byLabel(allMaterials, printVariant.material);
          if (m) setMaterial(m);
        }
        if (typeof printVariant?.frame !== "undefined") {
          const f = printVariant.frame ? byLabel(allFrames, printVariant.frame) : null;
          setFrame(f ?? null);
        }
      })
      .catch(console.error);
  }, [productId, user, guestId]);

  // ── derived basics ─────────────────────────────────────────────────
  const inCart: CartSelectedItem | undefined = product
    ? cart.find((item) => item.id === product.id)
    : undefined;


  const formats = useMemo(() => uniqFormats(product?.formats), [product?.formats]);
const saleStartsAt = toDate(product?.saleStartsAt as any);
const saleEndsAt   = toDate(product?.saleEndsAt as any);

  // Size string we send to API / use in pricing (supports custom)
  const sizeString = useMemo(() => {
    if (!wantPrint) return null;
    if (!isCustom) return size?.label ?? null;
    const w = parseFloat(customSize.width || "");
    const h = parseFloat(customSize.height || "");
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? `${w}x${h} in`
      : size?.label ?? null;
  }, [wantPrint, isCustom, customSize, size?.label]);

  // ── PRICE: API-identical on client (for UI only) ───────────────────
  const priceInfo = useMemo(() => {
    if (!product) return { baseUnit: 0, priceWithSale: 0, priceWithBundle: 0, finalUnitPrice: 0 };

    return computeFinalUnitPrice({
      productBase: product.price,
      salePrice: product.salePrice,
      salePercent: product.salePercent,
      saleStartsAt,
      saleEndsAt,

      format,
      size: sizeString,
      material: wantPrint ? material.label : null,
      frame: wantPrint ? frame?.label ?? null : null,
      license: wantDigital ? license.type : null,

      digital: wantDigital ? { type: "DIGITAL", format, license: license.type } : null,
      print: wantPrint
        ? { type: "PRINT", format, size: sizeString, material: material.label, frame: frame?.label ?? null }
        : null,

      sizeList: product.sizes,
    });
  }, [
    product,
    format,
    sizeString,
    wantPrint,
    wantDigital,
    material.label,
    frame,
    license.type,
  ]);

  const finalPrice = priceInfo.finalUnitPrice; // per-unit; multiply by qty at render-time if needed

  // ── helpers ────────────────────────────────────────────────────────
  const syncVariantId = (res: any, key: "digitalVariantId" | "printVariantId") => {
    if (res && key in res) {
      setOptions((o) => ({ ...o, [key]: res[key] || "" }));
    }
  };

  // ── toggles: no client price sent; server recomputes ───────────────
  const handleToggleDigital = useCallback(async () => {
    if (!product) return;
    const turningOn = !wantDigital;
    setWantDigital(turningOn);
    setOptions((o) => ({ ...o, digital: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        digitalVariantId: "ADD",
        updates: {
          format,
          license: license.type,
        } as CartUpdates,
      });
      syncVariantId(res, "digitalVariantId");
    } else {
      const res = await updateCart({
        productId: product.id,
        digitalVariantId: "REMOVE",
        updates: {},
      });
      syncVariantId(res, "digitalVariantId");
    }
  }, [product, wantDigital, inCart, updateCart, format, license.type]);

  const handleTogglePrint = useCallback(async () => {
    if (!product) return;
    const turningOn = !wantPrint;
    setWantPrint(turningOn);
    setOptions((o) => ({ ...o, print: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        printVariantId: "ADD",
        updates: {
          format,
          size: sizeString,
          material: material.label,
          frame: frame?.label ?? null,
        } as CartUpdates,
      });
      syncVariantId(res, "printVariantId");
    } else {
      const res = await updateCart({
        productId: product.id,
        printVariantId: "REMOVE",
        updates: {},
      });
      syncVariantId(res, "printVariantId");
    }
  }, [product, wantPrint, inCart, updateCart, format, sizeString, material.label, frame]);

  // ── selection setters that also sync cart (no price in updates) ────
  const selectLicense = useCallback(async (lic: LicenseOption) => {
    setLicense(lic);
    if (!product || !inCart || !updateCart || !options.digital) return;
    const res = await updateCart({
      productId: product.id,
      digitalVariantId: options.digitalVariantId || "ADD",
      updates: { license: lic.type, format } as CartUpdates,
    });
    if (!options.digitalVariantId) syncVariantId(res, "digitalVariantId");
  }, [product, inCart, updateCart, options.digital, options.digitalVariantId, format]);

  const selectSize = useCallback(async (next: SizeOption) => {
    setSize(next);
    setIsCustom(next.label.toLowerCase() === "custom");

    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { size: next.label } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId]);

  const changeCustomSize = useCallback(async (c: { width: string; height: string }) => {
    setCustomSize(c);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId) return;
    const w = parseFloat(c.width || "");
    const h = parseFloat(c.height || "");
    const label = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? `${w}x${h} in` : null;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { size: label } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId]);

  const selectMaterial = useCallback(async (m: MaterialOption) => {
    setMaterial(m);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { material: m.label } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId]);

  const selectFrame = useCallback(async (f: FrameOption | null) => {
    setFrame(f);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { frame: f?.label ?? null } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId]);

  const selectFormat = useCallback(async (next: string) => {
    setFormat(next);
    if (!product || !inCart || !updateCart) return;

    // Push to whichever variant(s) you consider format-bearing
    if (options.print && options.printVariantId) {
      await updateCart({
        productId: product.id,
        printVariantId: options.printVariantId,
        updates: { format: next } as CartUpdates,
      });
    }
    if (options.digital && options.digitalVariantId) {
      await updateCart({
        productId: product.id,
        digitalVariantId: options.digitalVariantId,
        updates: { format: next } as CartUpdates,
      });
    }
  }, [product, inCart, updateCart, options.print, options.printVariantId, options.digital, options.digitalVariantId]);

  // ── checkout (kept direct) ─────────────────────────────────────────
  const handleCheckoutAction = (maybeSetOpen?: unknown) =>
    product &&
    handleCheckout({
      user,
      guestId,
      inCart,
      addToCart,
      product,
      options: { ...options, digital: wantDigital, print: wantPrint },
      format,
      size: size || null,
      material,
      frame,
      license,
      setModalOpen: typeof maybeSetOpen === "function" ? (maybeSetOpen as (b: boolean) => void) : undefined,
      finalPrice: String(finalPrice), // UI only; server is authoritative
    });

  return {
    // data + cart
    product,
    inCart,
    loadingAdd,
    addToCart,
    removeFromCart,
    updateCart,

    // media
    preview,
    setPreview,
    formats,
    allSizes,

    // selection state
    wantDigital, setWantDigital: handleToggleDigital,   // toggle-aware
    wantPrint,  setWantPrint:  handleTogglePrint,       // toggle-aware
    license, setLicense: selectLicense,
    size, setSize: selectSize,
    isCustom, setIsCustom,
    customSize, setCustomSize: changeCustomSize,
    material, setMaterial: selectMaterial,
    frame, setFrame: selectFrame,
    format, setFormat: selectFormat,

    // options/ids
    options, setOptions,

    // pricing (identical to API technique)
    baseUnit: priceInfo.baseUnit,
    priceWithSale: priceInfo.priceWithSale,
    priceWithBundle: priceInfo.priceWithBundle,
    finalPrice, // per-unit

    // checkout
    handleCheckoutAction,
  };
}
