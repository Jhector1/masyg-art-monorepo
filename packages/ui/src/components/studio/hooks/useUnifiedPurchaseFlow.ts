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

// --- helpers --------------------------------------------------------------
const uniqFormats = (urls: string[] = []) => {
  const seen = new Set<string>();
  return urls
    .map((u) => (u?.split(".").pop() ?? "").toLowerCase())
    .filter((ext) => ext && !seen.has(ext) && seen.add(ext));
};

// 👇 KIND-AWARE: capability matrix
function capabilitiesByKind(kind?: ProductDetailResult["kind"], originalVariant?: any) {
  // If ORIGINAL exists for this product, disable both toggles (sell the original piece).
  if (originalVariant) {
    return {
      supportsDigital: false,
      supportsPrint: false,
      isOriginalOnly: true,
    };
  }
  switch (kind) {
    case "BOOK_DIGITAL":
      return { supportsDigital: true, supportsPrint: false, isOriginalOnly: false };
    case "STICKER":
    case "MUG":
    case "CARD":
      return { supportsDigital: false, supportsPrint: true, isOriginalOnly: false };
    case "ART":
    case "OTHER":
    default:
      return { supportsDigital: true, supportsPrint: true, isOriginalOnly: false };
  }
}

// Given kindInfo, prefer its sizes if present; else product.sizes
const sizesFromKindInfo = (p: ProductDetailResult): string[] => {
  const s = p?.kindInfo?.sizes;
  return Array.isArray(s) && s.length ? s : p.sizes ?? [];
};

// For MUG/STICKER/CARD we can lock material or show limited options.
// If your API returns a canonical material (e.g., "Ceramic" for MUG),
// you can preselect & limit choices. Keep it open by default otherwise.
const preferredMaterialForKind = (p?: ProductDetailResult): string | null => {
  if (!p?.kindInfo) return null;
  if (p.kind === "MUG" && p.kindInfo.material) return p.kindInfo.material;
  if (p.kind === "STICKER" && p.kindInfo.material) return p.kindInfo.material;
  if (p.kind === "CARD" && p.kindInfo.stock) return p.kindInfo.stock; // stock ~ material
  return null;
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
  const [wantDigital, _setWantDigital] = useState(false);
  const [wantPrint, _setWantPrint] = useState(false);
  const [license, setLicense] = useState<LicenseOption>(allLicenses[0]);
  const [size, setSize] = useState<SizeOption | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customSize, setCustomSize] = useState<{ width: string; height: string }>({ width: "", height: "" });
  const [material, setMaterial] = useState<MaterialOption>(allMaterials[0]);
  const [frame, setFrame] = useState<FrameOption | null>(null);
  const [format, setFormat] = useState<string>("");

  // derived caps (updated when product changes)
  const caps = useMemo(
    () => capabilitiesByKind(product?.kind, product?.originalVariant),
    [product?.kind, product?.originalVariant]
  );

  // enforcers to avoid illegal toggles
  const safeSetWantDigital = useCallback((next: boolean) => _setWantDigital(caps.supportsDigital ? next : false), [caps.supportsDigital]);
  const safeSetWantPrint   = useCallback((next: boolean) => _setWantPrint(caps.supportsPrint ? next : false),   [caps.supportsPrint]);

  // ── load product + seed from cart once ─────────────────────────────
  useEffect(() => {
    if (!productId) return;

    fetchProductById(productId, user?.id || guestId || "")
      .then((p) => {
        setProduct(p);
        setPreview({ src: p.imageUrl || "", alt: p.title });

        // sizes: prefer kindInfo.sizes; fall back to p.sizes
        const rawSizes = sizesFromKindInfo(p);
        setAllSizes(cleanSizes(rawSizes));

        // formats (digital files)
        const fmts = uniqFormats(p.formats);
        setFormat(fmts[0] || "png");

        // preselect material if the kind dictates one (e.g., Ceramic for MUG)
        const pref = preferredMaterialForKind(p);
        if (pref) {
          const m = allMaterials.find((x) => x.label.toLowerCase() === String(pref).toLowerCase());
          if (m) setMaterial(m);
        }

        // in-cart flags
        const printVariant = p.variants?.find((v) => v.type?.toUpperCase() === "PRINT" && v.inUserCart);
        const digitalVariant = p.variants?.find((v) => v.type?.toUpperCase() === "DIGITAL" && v.inUserCart);

        // seed kind-aware defaults; cart selection wins if present
        let seedDigital = Boolean(digitalVariant);
        let seedPrint = Boolean(printVariant);

        if (!seedDigital && !seedPrint) {
          // no cart state ⇒ choose sensible default by kind
          if (p.originalVariant) {
            seedDigital = false;
            seedPrint = false;
          } else if (p.kind === "BOOK_DIGITAL") {
            seedDigital = true;
            seedPrint = false;
          } else if (p.kind === "STICKER" || p.kind === "MUG" || p.kind === "CARD") {
            seedDigital = false;
            seedPrint = true;
          } else {
            // ART/OTHER: allow both off initially
            seedDigital = false;
            seedPrint = false;
          }
        }

        // enforce capabilities
        seedDigital = caps.supportsDigital ? seedDigital : false;
        seedPrint = caps.supportsPrint ? seedPrint : false;

        setOptions({
          digital: seedDigital,
          print: seedPrint,
          digitalVariantId: digitalVariant?.id || "",
          printVariantId: printVariant?.id || "",
        });

        safeSetWantDigital(seedDigital);
        safeSetWantPrint(seedPrint);

        // hydrate selections from cart (if present)
        const byType = (t?: string | null) => allLicenses.find((l) => l.type.toLowerCase() === (t || "").toLowerCase());
        const byLabel = <T extends { label: string }>(arr: T[], lbl?: string | null) =>
          arr.find((a) => a.label.toLowerCase() === (lbl || "").toLowerCase());

        if (digitalVariant?.license) {
          const lic = byType(digitalVariant.license);
          if (lic) setLicense(lic);
        }

        const sizePool = cleanSizes(rawSizes);
        if (printVariant?.size) {
          const sz = byLabel(sizePool, printVariant.size);
          if (sz) {
            setSize(sz);
            setIsCustom(sz.label.toLowerCase() === "custom");
          }
        } else {
          const first = sizePool[0];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user, guestId]);

  // ── derived basics ─────────────────────────────────────────────────
  const inCart: CartSelectedItem | undefined = product
    ? cart.find((item) => item.id === product.id)
    : undefined;

  const formats = useMemo(() => uniqFormats(product?.formats), [product?.formats]);
  const saleStartsAt = toDate(product?.saleStartsAt as any);
  const saleEndsAt   = toDate(product?.saleEndsAt as any);

  // Size string we send to API / use in pricing (supports custom; only if PRINT allowed)
  const sizeString = useMemo(() => {
    if (!wantPrint || !caps.supportsPrint) return null;
    if (!isCustom) return size?.label ?? null;
    const w = parseFloat(customSize.width || "");
    const h = parseFloat(customSize.height || "");
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? `${w}x${h} in`
      : size?.label ?? null;
  }, [wantPrint, caps.supportsPrint, isCustom, customSize, size?.label]);

  // ── PRICE: API-identical on client (for UI only) ───────────────────
  const priceInfo = useMemo(() => {
    if (!product) return { baseUnit: 0, priceWithSale: 0, priceWithBundle: 0, finalUnitPrice: 0 };

    // Only pass fields that are allowed by kind
    const allowDigital = caps.supportsDigital && wantDigital;
    const allowPrint   = caps.supportsPrint && wantPrint;

    return computeFinalUnitPrice({
      productBase: product.price,
      salePrice: product.salePrice,
      salePercent: product.salePercent,
      saleStartsAt,
      saleEndsAt,

      format,
      size: allowPrint ? sizeString : null,
      material: allowPrint ? material.label : null,
      frame: allowPrint ? frame?.label ?? null : null,
      license: allowDigital ? license.type : null,

      digital: allowDigital ? { type: "DIGITAL", format, license: license.type } : null,
      print: allowPrint
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
    caps.supportsDigital,
    caps.supportsPrint,
  ]);

  const finalPrice = priceInfo.finalUnitPrice; // per-unit; multiply by qty at render-time if needed

  // ── helpers ────────────────────────────────────────────────────────
  const syncVariantId = (res: any, key: "digitalVariantId" | "printVariantId") => {
    if (res && key in res) {
      setOptions((o) => ({ ...o, [key]: res[key] || "" }));
    }
  };

  // ── toggles: KIND-AWARE (no client price sent; server recomputes) ──
  const handleToggleDigital = useCallback(async () => {
    if (!product || !caps.supportsDigital) return; // 👈 KIND-AWARE
    const turningOn = !wantDigital;
    safeSetWantDigital(turningOn);
    setOptions((o) => ({ ...o, digital: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        digitalVariantId: "ADD",
        updates: { format, license: license.type } as CartUpdates,
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
  }, [product, caps.supportsDigital, wantDigital, inCart, updateCart, format, license.type, safeSetWantDigital]);

  const handleTogglePrint = useCallback(async () => {
    if (!product || !caps.supportsPrint) return; // 👈 KIND-AWARE
    const turningOn = !wantPrint;
    safeSetWantPrint(turningOn);
    setOptions((o) => ({ ...o, print: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        printVariantId: "ADD",
        updates: { format, size: sizeString, material: material.label, frame: frame?.label ?? null } as CartUpdates,
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
  }, [product, caps.supportsPrint, wantPrint, inCart, updateCart, format, sizeString, material.label, frame, safeSetWantPrint]);

  // ── selection setters that also sync cart (no price in updates) ────
  const selectLicense = useCallback(async (lic: LicenseOption) => {
    setLicense(lic);
    if (!product || !inCart || !updateCart || !options.digital || !caps.supportsDigital) return;
    const res = await updateCart({
      productId: product.id,
      digitalVariantId: options.digitalVariantId || "ADD",
      updates: { license: lic.type, format } as CartUpdates,
    });
    if (!options.digitalVariantId) syncVariantId(res, "digitalVariantId");
  }, [product, inCart, updateCart, options.digital, options.digitalVariantId, format, caps.supportsDigital]);

  const selectSize = useCallback(async (next: SizeOption) => {
    setSize(next);
    setIsCustom(next.label.toLowerCase() === "custom");
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId || !caps.supportsPrint) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { size: next.label } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const changeCustomSize = useCallback(async (c: { width: string; height: string }) => {
    setCustomSize(c);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId || !caps.supportsPrint) return;
    const w = parseFloat(c.width || "");
    const h = parseFloat(c.height || "");
    const label = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? `${w}x${h} in` : null;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { size: label } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const selectMaterial = useCallback(async (m: MaterialOption) => {
    setMaterial(m);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId || !caps.supportsPrint) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { material: m.label } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const selectFrame = useCallback(async (f: FrameOption | null) => {
    setFrame(f);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId || !caps.supportsPrint) return;
    await updateCart({
      productId: product.id,
      printVariantId: options.printVariantId,
      updates: { frame: f?.label ?? null } as CartUpdates,
    });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const selectFormat = useCallback(async (next: string) => {
    setFormat(next);
    if (!product || !inCart || !updateCart) return;
    if (options.print && options.printVariantId && caps.supportsPrint) {
      await updateCart({
        productId: product.id,
        printVariantId: options.printVariantId,
        updates: { format: next } as CartUpdates,
      });
    }
    if (options.digital && options.digitalVariantId && caps.supportsDigital) {
      await updateCart({
        productId: product.id,
        digitalVariantId: options.digitalVariantId,
        updates: { format: next } as CartUpdates,
      });
    }
  }, [product, inCart, updateCart, options.print, options.printVariantId, options.digital, options.digitalVariantId, caps.supportsDigital, caps.supportsPrint]);

  // ── checkout (kept direct) ─────────────────────────────────────────
  const handleCheckoutAction = (maybeSetOpen?: unknown) =>
    product &&
    handleCheckout({
      user,
      guestId,
      inCart,
      addToCart,
      product,
      options: { ...options, digital: caps.supportsDigital && wantDigital, print: caps.supportsPrint && wantPrint }, // 👈 enforce caps
      format,
      size: caps.supportsPrint ? size || null : null,
      material: caps.supportsPrint ? material : allMaterials[0],
      frame: caps.supportsPrint ? frame : null,
      license: caps.supportsDigital ? license : allLicenses[0],
      setModalOpen: typeof maybeSetOpen === "function" ? (maybeSetOpen as (b: boolean) => void) : undefined,
      finalPrice: String(finalPrice), // UI only; server is authoritative
    });

  // Expose a couple of UI hints (what to hide/disable)
  const ui = {
    canPickDigital: caps.supportsDigital && !caps.isOriginalOnly,
    canPickPrint: caps.supportsPrint && !caps.isOriginalOnly,
    isOriginalOnly: caps.isOriginalOnly,
    // For MUG/STICKER/CARD you *can* opt to lock material picker:
    lockMaterialToKind: Boolean(preferredMaterialForKind(product || undefined)),
  };

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

    // selection state (kind-aware toggles)
    wantDigital, setWantDigital: handleToggleDigital,
    wantPrint,  setWantPrint:  handleTogglePrint,
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

    // 👇 KIND-AWARE UI flags for your Configurator/Actions
    ui,
  };
}
