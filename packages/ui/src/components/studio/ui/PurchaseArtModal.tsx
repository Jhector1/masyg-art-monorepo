// src/components/studio/ui/PurchaseArtModal.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@acme/core/contexts/CartContext";

import ProductConfigurator from "../../product/detail/ProductConfigurator";
import { allFrames, allLicenses, allMaterials, allSizes } from "@acme/core/data/helpers";

import type { LicenseOption, MaterialOption, FrameOption } from "@acme/core/types";
import type { SizeOption } from "../../product/shared/core/SizeSelectorCore";

import { useProductData } from "../hooks/useProductData";

type RequiredDesignPayload = {
  id?: string;
  style: any;
  defs?: string | null;
};

type DigitalOpts = { format: string; license?: string };
type PrintOpts = {
  format: string;
  size?: string | null;
  material?: string | null;
  frame?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  busy?: boolean;

  productId: string;
  imageSrc: string;

  licenses?: LicenseOption[];
  optionSizes?: SizeOption[];
  materials?: MaterialOption[];
  frames?: FrameOption[];

  defaultVariant?: "digital" | "print";

  digital?: DigitalOpts | null;
  print?: PrintOpts | null;

  design: RequiredDesignPayload;
  getPreviewDataUrl: () => Promise<string | null>;

  onCheckout?: (opts: {
    variant: "digital" | "print";
    quantity: number;
    productId: string;
    price: number;
    digital?: DigitalOpts | null;
    print?: PrintOpts | null;
    design: RequiredDesignPayload;
  }) => Promise<void> | void;

  snapshotCartItem?: boolean;
  showFormat?: boolean;
  setHeaderBooting: (booting: boolean) => void;
};

export default function PurchaseArtModal({
  open,
  onClose,
  busy = false,
  setHeaderBooting,

  productId,
  imageSrc,

  licenses: licensesProp = allLicenses,
  optionSizes: optionSizesProp = allSizes,
  materials = allMaterials,
  frames: framesProp = allFrames,

  digital = { format: "png", license: "personal" },
  print = { format: "jpg" },

  design,
  getPreviewDataUrl,

  snapshotCartItem = true,
}: Props) {
  const portalEl = useRef<HTMLElement | null>(null);
  const firstFocusRef = useRef<HTMLButtonElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>(imageSrc || "");

  // Shared product state + server-identical unit price
  const {
    product,
    // selections used by configurator
    options, setOptions,
    size, setSize,
    customSize, setCustomSize,
    isCustom, setIsCustom,
    material, setMaterial,
    frame, setFrame,
    license, setLicense,
    wantDigital, setWantDigital,
    wantPrint, setWantPrint,

    // cart + flow
    inCart,
    removeFromCart,
    handleCheckoutAction,

    // unified per-unit price (for display only)
    finalPrice,
  } = useProductData({ productId });

  // Cart API (used here only for ADD with a design snapshot)
  const cartApi = useCart() as any;

  // Try to refresh preview when modal opens
  useEffect(() => {
    let cancelled = false;
    if (!open) return;
    (async () => {
      try {
        const dataUrl = await getPreviewDataUrl?.();
        if (!cancelled && dataUrl) setPreviewSrc(dataUrl);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [open, getPreviewDataUrl]);

  // portal target
  useEffect(() => {
    portalEl.current = document.body;
  }, []);

  // close on escape + lock scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) firstFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  // Build a fresh design payload with preview image (if available)
  const buildDesignWithPreview = useCallback(async (): Promise<
    RequiredDesignPayload & { previewDataUrl?: string }
  > => {
    const previewDataUrl = (await getPreviewDataUrl?.()) ?? undefined;
    return {
      id: design?.id,
      style: design.style,
      defs: design.defs ?? null,
      ...(previewDataUrl ? { previewDataUrl } : {}),
    };
  }, [design, getPreviewDataUrl]);

  const isBusy = busy || adding;

  // Add (with design snapshot) or remove
  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    if (!wantDigital && !wantPrint) {
      setErr("Select at least one option (Digital or Print).");
      return;
    }
    if (typeof cartApi?.addToCartWithDesign !== "function") {
      setErr("CartContext.addToCartWithDesign is required for design purchases.");
      return;
    }

    setAdding(true);
    setErr(null);
    try {
      if (!inCart) {
        const designPayload = await buildDesignWithPreview();

        // Choose one format to snapshot on the line
        const chosenFormat =
          digital?.format ??
          print?.format ??
          (product.formats[0]?.split(".").pop() || "png");

        // ✅ Do NOT send price; server computes authoritative price
        await cartApi.addToCartWithDesign({
          productId,
          digitalType: wantDigital ? "DIGITAL" : null,
          printType:  wantPrint  ? "PRINT"   : null,
          quantity: 1,
          format: chosenFormat,
          size: wantPrint ? (size?.label ?? null) : null,
          material: wantPrint ? (material?.label ?? null) : null,
          frame: wantPrint ? (frame?.label ?? null) : null,
          license: wantDigital ? license?.type : license?.type, // snapshot current license
          design: designPayload,
          snapshot: snapshotCartItem,
        });

        onClose();
      } else {
        await removeFromCart(
          product.id,
          options.digitalVariantId!,
          options.printVariantId!
        );
      }
    } catch (e: any) {
      console.error("Add to cart failed:", e);
      setErr(e?.message || "Failed to add to cart. Please try again.");
    } finally {
      setAdding(false);
    }
  }, [
    product, productId,
    wantDigital, wantPrint,
    size, material, frame, license,
    digital?.format, print?.format,
    cartApi,
    buildDesignWithPreview,
    snapshotCartItem,
    inCart, options.digitalVariantId, options.printVariantId, removeFromCart,
    onClose,
  ]);

  // Some configurator versions still accept a calculatePrice prop even if unused.
  // Provide a harmless stub to avoid runtime TypeErrors across variants.
  // const stubCalculatePrice = useCallback(
  //   (_type: "Digital" | "Print") => ({ digitalPrice: "0", printPrice: "0" }),
  //   []
  // );

  const disabled = isBusy || (!wantDigital && !wantPrint);
  const portalTarget = portalEl.current;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed inset-0 z-[60] overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="purchase-art-title"
                className="relative w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/10
                           max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-y-auto"
                initial={{ y: 20, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 12, opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 id="purchase-art-title" className="text-base font-semibold">
                    Purchase this customized artwork
                  </h3>
                  <button
                    onClick={onClose}
                    className="rounded-md p-1 text-black/60 hover:bg-zinc-100 hover:text-black/80"
                    aria-label="Close"
                    ref={firstFocusRef}
                  >
                    ✕
                  </button>
                </div>

                {/* Same configurator UX as the product page */}
                {product && (
                  <div className="space-y-5">
                    <ProductConfigurator
                      showFormat={false}
                      previewImageSrc={previewSrc}
                      product={product}
                      inCart={inCart || null}
                      materials={materials}
                      frames={framesProp}
                      licenses={licensesProp}
                      optionSizes={optionSizesProp}
                      formatData={{ options, setOptions }}
                      licenseData={{ license, setLicense }}
                      sizeData={{
                        size,
                        setSize,
                        customSize,
                        setCustomSize,
                        isCustom,
                        setIsCustom,
                      }}
                      materialData={{ material, setMaterial }}
                      frameData={{ frame, setFrame }}
                      selection={{ wantDigital, setWantDigital, wantPrint, setWantPrint }}
                      // pass stub for compatibility (ignored by unified configurator)
                      // calculatePrice={stubCalculatePrice as any}
                    />
                  </div>
                )}

                {err && (
                  <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {err}
                  </div>
                )}

                <div className="py-5 mt-3 sticky bottom-0 flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end bg-white">
                  <button
                    onClick={handleAddToCart}
                    disabled={disabled}
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-emerald-600/20",
                      "bg-white text-emerald-700 hover:bg-emerald-50",
                      disabled ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                    aria-busy={isBusy}
                  >
                    {adding ? (inCart ? "Removing…" : "Adding…") : inCart ? "Remove from Cart" : "Add to Cart"}
                  </button>

                  <button
                    onClick={async () => {
                      // Let the page-level checkout flow handle Stripe (embedded/redirect/session)
                      setHeaderBooting(true);
                      const result = await handleCheckoutAction({
                        openUI: false,
                        exportHref: "/account/orders",
                      });

                      if (result?.status === "error") {
                        setHeaderBooting(false);
                        setErr(result?.message || "Checkout failed. Please try again.");
                        return;
                      }
                      if (result?.status === "auth_required") {
                        setHeaderBooting(false);
                        return;
                      }

                      // Close modal so Stripe isn't layered underneath
                      onClose();
                      await new Promise((r) => requestAnimationFrame(r));

                      if (result?.flow === "embedded") {
                        window.dispatchEvent(
                          new CustomEvent("open-checkout", {
                            detail: { clientSecret: result.clientSecret, exportHref: "/account/orders" },
                          })
                        );
                      } else if (result?.flow === "redirect") {
                        window.location.href = result.url;
                      } else if (result?.flow === "sessionId") {
                        setHeaderBooting(false);
                        const stripe = await import("@stripe/stripe-js").then((m) =>
                          m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
                        );
                        await stripe?.redirectToCheckout({ sessionId: result.sessionId });
                      }
                    }}
                    disabled={disabled}
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-medium",
                      !disabled ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-emerald-300 text-white",
                      disabled ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                    aria-busy={isBusy}
                  >
                    {busy ? "Processing…" : `Buy now — $${Number(finalPrice).toFixed(2)}`}
                  </button>

                  <button
                    onClick={onClose}
                    className="rounded-xl px-3 py-2 text-sm ring-1 ring-zinc-200 hover:bg-zinc-50"
                    disabled={isBusy}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalTarget
  );
}
