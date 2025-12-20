"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

function capabilitiesByKind(
  kind?: ProductDetailResult["kind"],
  originalVariant?: any
) {
  if (originalVariant) {
    return { supportsDigital: false, supportsPrint: false, isOriginalOnly: true };
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

const sizesFromKindInfo = (p: ProductDetailResult): string[] => {
  const s = p?.kindInfo?.sizes;
  return Array.isArray(s) && s.length ? s : p.sizes ?? [];
};

const preferredMaterialForKind = (p?: ProductDetailResult): string | null => {
  if (!p?.kindInfo) return null;
  if (p.kind === "MUG" && p.kindInfo.material) return p.kindInfo.material;
  if (p.kind === "STICKER" && p.kindInfo.material) return p.kindInfo.material;
  if (p.kind === "CARD" && p.kindInfo.stock) return p.kindInfo.stock;
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

  // on/off + variant ids persisted in cart
  const [options, setOptions] = useState<AddOptions>({
    digital: false,
    print: false,
    digitalVariantId: "",
    printVariantId: "",
  });

  // selections
  const [wantDigital, _setWantDigital] = useState(false);
  const [wantPrint, _setWantPrint] = useState(false);
  const [license, setLicense] = useState<LicenseOption>(allLicenses[0]);
  const [size, setSize] = useState<SizeOption | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customSize, setCustomSize] = useState<{ width: string; height: string }>({ width: "", height: "" });
  const [material, setMaterial] = useState<MaterialOption>(allMaterials[0]);
  const [frame, setFrame] = useState<FrameOption | null>(null);
  const [format, setFormat] = useState<string>("");

  // derived caps
  const caps = useMemo(
    () => capabilitiesByKind(product?.kind, product?.originalVariant),
    [product?.kind, product?.originalVariant]
  );

  const safeSetWantDigital = useCallback(
    (next: boolean) => _setWantDigital(caps.supportsDigital ? next : false),
    [caps.supportsDigital]
  );
  const safeSetWantPrint = useCallback(
    (next: boolean) => _setWantPrint(caps.supportsPrint ? next : false),
    [caps.supportsPrint]
  );

  // ✅ IMPORTANT: find cart item by productId safely (your cart items may have id===productId)
  const inCart: CartSelectedItem | undefined = useMemo(() => {
    return cart.find((item: any) => item.productId === productId || item.id === productId);
  }, [cart, productId]);

  // ── load product (only product catalog data + sensible defaults) ───
  useEffect(() => {
    if (!productId) return;

    // reset per-product hydration guards
    hydratedRef.current = null;
    seededRef.current = null;

    fetchProductById(productId, user?.id || guestId || "")
      .then((p) => {
        setProduct(p);
        setPreview({ src: p.imageUrl || "", alt: p.title });

        const rawSizes = sizesFromKindInfo(p);
        const sizePool = cleanSizes(rawSizes);
        setAllSizes(sizePool);

        const fmts = uniqFormats(p.formats);
        setFormat(fmts[0] || "png");

        const pref = preferredMaterialForKind(p);
        if (pref) {
          const m = allMaterials.find(
            (x) => x.label.toLowerCase() === String(pref).toLowerCase()
          );
          if (m) setMaterial(m);
        }

        // seed basic defaults ONCE (cart hydration will override later)
        const nextCaps = capabilitiesByKind(p.kind, (p as any).originalVariant);

        // if no cart yet, choose a kind-appropriate default selection (optional)
        if (!inCart) {
          let seedDigital = false;
          let seedPrint = false;

          if ((p as any).originalVariant) {
            seedDigital = false;
            seedPrint = false;
          } else if (p.kind === "BOOK_DIGITAL") {
            seedDigital = true;
            seedPrint = false;
          } else if (p.kind === "STICKER" || p.kind === "MUG" || p.kind === "CARD") {
            seedDigital = false;
            seedPrint = true;
          }

          seedDigital = nextCaps.supportsDigital ? seedDigital : false;
          seedPrint = nextCaps.supportsPrint ? seedPrint : false;

          setOptions((o) => ({
            ...o,
            digital: seedDigital,
            print: seedPrint,
            digitalVariantId: "",
            printVariantId: "",
          }));

          _setWantDigital(seedDigital);
          _setWantPrint(seedPrint);

          if (sizePool?.[0]) setSize(sizePool[0]);
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user, guestId]);

  // ── ✅ HYDRATE selections from CART when inCart becomes available ───
  const hydratedRef = useRef<string | null>(null);
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    if (!product) return;
    if (!inCart) {
      hydratedRef.current = null;
      return;
    }

    const key = `${product.id}:${(inCart as any).cartItemId ?? ""}:${(inCart as any).digital?.id ?? ""}:${(inCart as any).print?.id ?? ""}`;
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;

    const digital = (inCart as any).digital ?? null;
    const print = (inCart as any).print ?? null;

    const hasDigital = Boolean(digital);
    const hasPrint = Boolean(print);

    safeSetWantDigital(hasDigital);
    safeSetWantPrint(hasPrint);

    // ✅ critical: keep variant ids in options so client sends ID not "ADD"
    setOptions((o) => ({
      ...o,
      digital: caps.supportsDigital ? hasDigital : false,
      print: caps.supportsPrint ? hasPrint : false,
      digitalVariantId: hasDigital ? (digital?.id ?? "") : "",
      printVariantId: hasPrint ? (print?.id ?? "") : "",
    }));

    // DIGITAL fields
    if (hasDigital) {
      if (digital?.license) {
        const lic = allLicenses.find(
          (l) => l.type.toLowerCase() === String(digital.license).toLowerCase()
        );
        if (lic) setLicense(lic);
      }
      if (digital?.format) setFormat(String(digital.format).toLowerCase());
    }

    // PRINT fields
    if (hasPrint) {
      if (print?.format) setFormat(String(print.format).toLowerCase());

      if (print?.material) {
        const m = allMaterials.find(
          (x) => x.label.toLowerCase() === String(print.material).toLowerCase()
        );
        if (m) setMaterial(m);
      }

      if (typeof print?.frame !== "undefined") {
        const f = print.frame
          ? allFrames.find(
              (x) => x.label.toLowerCase() === String(print.frame).toLowerCase()
            )
          : null;
        setFrame(f ?? null);
      }

      if (print?.size) {
        const sizePool = cleanSizes(sizesFromKindInfo(product));
        const found = sizePool.find(
          (s) => s.label.toLowerCase() === String(print.size).toLowerCase()
        );
        if (found) {
          setSize(found);
          setIsCustom(found.label.toLowerCase() === "custom");
        }
      }
    }
  }, [product?.id, inCart, caps.supportsDigital, caps.supportsPrint, safeSetWantDigital, safeSetWantPrint]);

  // ── derived basics ─────────────────────────────────────────────────
  const formats = useMemo(() => uniqFormats(product?.formats), [product?.formats]);
  const saleStartsAt = toDate(product?.saleStartsAt as any);
  const saleEndsAt = toDate(product?.saleEndsAt as any);

  const sizeString = useMemo(() => {
    if (!wantPrint || !caps.supportsPrint) return null;
    if (!isCustom) return size?.label ?? null;
    const w = parseFloat(customSize.width || "");
    const h = parseFloat(customSize.height || "");
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? `${w}x${h} in`
      : size?.label ?? null;
  }, [wantPrint, caps.supportsPrint, isCustom, customSize, size?.label]);

  const priceInfo = useMemo(() => {
    if (!product) return { baseUnit: 0, priceWithSale: 0, priceWithBundle: 0, finalUnitPrice: 0 };

    const allowDigital = caps.supportsDigital && wantDigital;
    const allowPrint = caps.supportsPrint && wantPrint;

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

  const finalPrice = priceInfo.finalUnitPrice;

  const syncVariantId = (res: any, key: "digitalVariantId" | "printVariantId") => {
    if (res && key in res) setOptions((o) => ({ ...o, [key]: res[key] || "" }));
  };

  // toggles (server recomputes price)
  const handleToggleDigital = useCallback(async () => {
    if (!product || !caps.supportsDigital) return;
    const turningOn = !wantDigital;
    safeSetWantDigital(turningOn);
    setOptions((o) => ({ ...o, digital: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        digitalVariantId: options.digitalVariantId || "ADD",
        updates: { format, license: license.type } as CartUpdates,
      });
      syncVariantId(res, "digitalVariantId");
    } else {
      const res = await updateCart({ productId: product.id, digitalVariantId: "REMOVE", updates: {} });
      syncVariantId(res, "digitalVariantId");
    }
  }, [product, caps.supportsDigital, wantDigital, inCart, updateCart, format, license.type, safeSetWantDigital, options.digitalVariantId]);

  const handleTogglePrint = useCallback(async () => {
    if (!product || !caps.supportsPrint) return;
    const turningOn = !wantPrint;
    safeSetWantPrint(turningOn);
    setOptions((o) => ({ ...o, print: turningOn }));

    if (!inCart || !updateCart) return;

    if (turningOn) {
      const res = await updateCart({
        productId: product.id,
        printVariantId: options.printVariantId || "ADD",
        updates: { format, size: sizeString, material: material.label, frame: frame?.label ?? null } as CartUpdates,
      });
      syncVariantId(res, "printVariantId");
    } else {
      const res = await updateCart({ productId: product.id, printVariantId: "REMOVE", updates: {} });
      syncVariantId(res, "printVariantId");
    }
  }, [product, caps.supportsPrint, wantPrint, inCart, updateCart, format, sizeString, material.label, frame, safeSetWantPrint, options.printVariantId]);

  // selection setters (no price)
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
    await updateCart({ productId: product.id, printVariantId: options.printVariantId, updates: { size: next.label } as CartUpdates });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const changeCustomSize = useCallback(async (c: { width: string; height: string }) => {
    setCustomSize(c);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId || !caps.supportsPrint) return;
    const w = parseFloat(c.width || "");
    const h = parseFloat(c.height || "");
    const label = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? `${w}x${h} in` : null;
    await updateCart({ productId: product.id, printVariantId: options.printVariantId, updates: { size: label } as CartUpdates });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const selectMaterial = useCallback(async (m: MaterialOption) => {
    setMaterial(m);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId || !caps.supportsPrint) return;
    await updateCart({ productId: product.id, printVariantId: options.printVariantId, updates: { material: m.label } as CartUpdates });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const selectFrame = useCallback(async (f: FrameOption | null) => {
    setFrame(f);
    if (!product || !inCart || !updateCart || !options.print || !options.printVariantId || !caps.supportsPrint) return;
    await updateCart({ productId: product.id, printVariantId: options.printVariantId, updates: { frame: f?.label ?? null } as CartUpdates });
  }, [product, inCart, updateCart, options.print, options.printVariantId, caps.supportsPrint]);

  const selectFormat = useCallback(async (next: string) => {
    setFormat(next);
    if (!product || !inCart || !updateCart) return;

    if (options.print && options.printVariantId && caps.supportsPrint) {
      await updateCart({ productId: product.id, printVariantId: options.printVariantId, updates: { format: next } as CartUpdates });
    }
    if (options.digital && options.digitalVariantId && caps.supportsDigital) {
      await updateCart({ productId: product.id, digitalVariantId: options.digitalVariantId, updates: { format: next } as CartUpdates });
    }
  }, [product, inCart, updateCart, options.print, options.printVariantId, options.digital, options.digitalVariantId, caps.supportsDigital, caps.supportsPrint]);

  const handleCheckoutAction = (maybeSetOpen?: unknown) =>
    product &&
    handleCheckout({
      user,
      guestId,
      inCart,
      addToCart,
      product,
      options: { ...options, digital: caps.supportsDigital && wantDigital, print: caps.supportsPrint && wantPrint },
      format,
      size: caps.supportsPrint ? size || null : null,
      material: caps.supportsPrint ? material : allMaterials[0],
      frame: caps.supportsPrint ? frame : null,
      license: caps.supportsDigital ? license : allLicenses[0],
      setModalOpen: typeof maybeSetOpen === "function" ? (maybeSetOpen as (b: boolean) => void) : undefined,
      finalPrice: String(finalPrice),
    });

  const ui = {
    canPickDigital: caps.supportsDigital && !caps.isOriginalOnly,
    canPickPrint: caps.supportsPrint && !caps.isOriginalOnly,
    isOriginalOnly: caps.isOriginalOnly,
    lockMaterialToKind: Boolean(preferredMaterialForKind(product || undefined)),
  };

  return {
    product,
    inCart,
    loadingAdd,
    addToCart,
    removeFromCart,
    updateCart,

    preview,
    setPreview,
    formats,
    allSizes,

    wantDigital,
    setWantDigital: handleToggleDigital,
    wantPrint,
    setWantPrint: handleTogglePrint,

    license,
    setLicense: selectLicense,
    size,
    setSize: selectSize,
    isCustom,
    setIsCustom,
    customSize,
    setCustomSize: changeCustomSize,
    material,
    setMaterial: selectMaterial,
    frame,
    setFrame: selectFrame,
    format,
    setFormat: selectFormat,

    options,
    setOptions,

    baseUnit: priceInfo.baseUnit,
    priceWithSale: priceInfo.priceWithSale,
    priceWithBundle: priceInfo.priceWithBundle,
    finalPrice,

    handleCheckoutAction,
    ui,
  };
}
