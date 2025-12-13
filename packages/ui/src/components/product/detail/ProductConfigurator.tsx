// src/components/product/detail/ProductConfigurator.tsx
"use client";

import React from "react";
import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import PurchaseOptionsCore from "../shared/core/PurchaseOptionsCore";
import LicenseSelectorCore from "../shared/core/LicenseSelectorCore";
import SizeSelectorCore, {
  type SizeOption,
} from "../shared/core/SizeSelectorCore";
import PrintCustomizerCore from "../shared/core/PrintCustomizerCore";
import FormatSelector from "../FormatSelector";
import { SaleAndCountdown } from "../shared/core/SalePriceAndCountDown";
import { DescriptionCard } from "../shared/core/DescriptionCard";

import { useCart } from "@acme/core/contexts/CartContext";
import { usePurchaseConfigurator } from "@acme/core/hooks/usePurchaseConfigurator";
import { cleanSizes } from "@acme/core/utils/helpers";
import { computeFinalUnitPrice } from "@acme/core/lib/finalize";
import { roundMoney } from "@acme/core/lib/pricing";

import type {
  ProductDetailResult,
  FrameOption,
  MaterialOption,
  AddOptions,
  LicenseOption,
  CartUpdates,
  CartSelectedItem,
} from "@acme/core/types";

/* ------------------------------------------------------------------
   Kind policy: what to allow & what to hide per kind + special layout
------------------------------------------------------------------- */
type KindPolicy = {
  allow: { digital: boolean; print: boolean };
  hide: Partial<
    Record<"format" | "license" | "size" | "material" | "frame", boolean>
  >;
  renderMode?: "default" | "book";
};

function getKindPolicy(product: ProductDetailResult): KindPolicy {
  switch (product.kind) {
    case "BOOK_DIGITAL": {
      const hasEditions =
        Array.isArray(product.sizes) && product.sizes.length > 0;
      return {
        allow: { digital: true, print: true },
        hide: {
          material: true,
          frame: true,
          size: !hasEditions, // only show sizes if you model editions/trim sizes here
        },
        renderMode: "book",
      };
    }
    case "STICKER":
      return {
        allow: { digital: false, print: true },
        hide: { license: true, material: true, frame: true }, // just size/format if you expose format; often even format is fixed
        renderMode: "default",
      };
    case "MUG":
      return {
        allow: { digital: false, print: true },
        hide: {
          license: true,
          material: true,
          frame: true,
          format: true,
          size: false,
        }, // keep size (11oz/15oz)
        renderMode: "default",
      };
    case "CARD":
      return {
        allow: { digital: false, print: true },
        hide: { license: true, material: true, frame: true }, // show size if you have it
        renderMode: "default",
      };
    case "ART":
      return {
        allow: { digital: true, print: true },
        hide: {},
        renderMode: "default",
      };
    case "OTHER":
      return {
        allow: { digital: false, print: true },
        hide: {
          license: true,
          material: true,
          frame: true,
          format: true,
          size: false,
        }, // keep size (11oz/15oz)
        renderMode: "default",
      };
    default:
      return {
        allow: { digital: true, print: true },
        hide: {},
        renderMode: "default",
      };
  }
}

/* ------------------------------------------------------------------
   Props
------------------------------------------------------------------- */
interface SelectionModel {
  wantDigital: boolean;
  setWantDigital: (v: boolean) => void;
  wantPrint: boolean;
  setWantPrint: (v: boolean) => void;
}

interface ProductConfiguratorProps {
  previewImageSrc?: string;

  showFormat?: boolean;
  product: ProductDetailResult;
  inCart: CartSelectedItem | null;

  materials: MaterialOption[];
  licenses: LicenseOption[];
  frames: FrameOption[];
  optionSizes: SizeOption[];

  formatData: {
    options: AddOptions;
    setOptions: React.Dispatch<React.SetStateAction<AddOptions>>;
  };
  licenseData: {
    license: LicenseOption;
    setLicense: React.Dispatch<React.SetStateAction<LicenseOption>>;
  };
  sizeData: {
    size: SizeOption;
    setSize: (val: SizeOption) => void;
    customSize: { width: string; height: string };
    setCustomSize: (val: { width: string; height: string }) => void;
    isCustom: boolean;
    setIsCustom: (val: boolean) => void;
  };
  materialData: {
    material: MaterialOption;
    setMaterial: (val: MaterialOption) => void;
  };
  frameData: {
    frame: FrameOption | null;
    setFrame: (val: FrameOption | null) => void;
  };

  selection: SelectionModel;
}

/* ==================================================================
   Component
================================================================== */
export default function ProductConfigurator(props: ProductConfiguratorProps) {
  const {
    showFormat = true,
    product,
    inCart,
    materials,
    licenses,
    frames,
    formatData,
    licenseData,
    sizeData,
    materialData,
    frameData,
    selection,
  } = props;

  const policy = getKindPolicy(product);
  const availableSizes = cleanSizes(product.sizes);
  const { updateCart } = useCart();

  const ctrl = usePurchaseConfigurator({
    product,
    wantDigital: selection.wantDigital,
    setWantDigital: selection.setWantDigital,
    wantPrint: selection.wantPrint,
    setWantPrint: selection.setWantPrint,

    license: licenseData.license,
    setLicense: licenseData.setLicense,

    size: sizeData.size,
    setSize: sizeData.setSize,
    customSize: sizeData.customSize,
    setCustomSize: sizeData.setCustomSize,
    isCustom: sizeData.isCustom,
    setIsCustom: sizeData.setIsCustom,

    material: materialData.material,
    setMaterial: materialData.setMaterial,

    frame: frameData.frame,
    setFrame: frameData.setFrame,

    inCart,
    updateCart: (input) =>
      updateCart({
        productId: input.productId,
        digitalVariantId: input.digitalVariantId,
        printVariantId: input.printVariantId,
        updates: input.updates, // never price
      }),
    options: formatData.options,
    setOptions: formatData.setOptions,
  });

  /* ---------- Shared pricing inputs ---------- */
  const sizeString = useMemo(() => {
    if (!selection.wantPrint) return null;
    if (!sizeData.isCustom) return sizeData.size?.label ?? null;
    const w = parseFloat(sizeData.customSize.width || "");
    const h = parseFloat(sizeData.customSize.height || "");
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? `${w}x${h} in`
      : (sizeData.size?.label ?? null);
  }, [
    selection.wantPrint,
    sizeData.isCustom,
    sizeData.customSize,
    sizeData.size?.label,
  ]);

  const saleStartsAt = product?.saleStartsAt
    ? new Date(product.saleStartsAt as any)
    : null;
  const saleEndsAt = product?.saleEndsAt
    ? new Date(product.saleEndsAt as any)
    : null;

  const priceInfo = useMemo(() => {
    return computeFinalUnitPrice({
      productBase: product.price,
      salePrice: (product as any).salePrice ?? null,
      salePercent: (product as any).salePercent ?? null,
      saleStartsAt,
      saleEndsAt,
      format: ctrl.format,
      size: sizeString,
      material: policy.hide.material
        ? null
        : selection.wantPrint
          ? materialData.material.label
          : null,
      frame: policy.hide.frame
        ? null
        : selection.wantPrint
          ? (frameData.frame?.label ?? null)
          : null,
      license:
        !policy.hide.license && selection.wantDigital
          ? licenseData.license.type
          : null,
      digital: selection.wantDigital
        ? {
            type: "DIGITAL",
            format: ctrl.format,
            license: (!policy.hide.license
              ? licenseData.license.type
              : null) as any,
          }
        : null,
      print: selection.wantPrint
        ? {
            type: "PRINT",
            format: ctrl.format,
            size: sizeString,
            material: policy.hide.material ? null : materialData.material.label,
            frame: policy.hide.frame ? null : (frameData.frame?.label ?? null),
          }
        : null,
      sizeList: product.sizes,
    });
  }, [
    product,
    ctrl.format,
    sizeString,
    selection.wantPrint,
    selection.wantDigital,
    materialData.material.label,
    frameData.frame,
    licenseData.license.type,
    policy.hide.material,
    policy.hide.frame,
    policy.hide.license,
    saleStartsAt,
    saleEndsAt,
  ]);

  const finalUnitPrice = priceInfo.finalUnitPrice;
  const bundleWins =
    selection.wantDigital &&
    selection.wantPrint &&
    priceInfo.priceWithBundle < priceInfo.priceWithSale;
  const saleActive =
    !bundleWins && priceInfo.priceWithSale < priceInfo.baseUnit;

  const pricing = {
    price: finalUnitPrice,
    compareAt: bundleWins || saleActive ? roundMoney(priceInfo.baseUnit) : null,
    onSale: bundleWins ? true : saleActive,
    endsAt: bundleWins ? null : saleEndsAt,
  } as const;

  /* ==================================================================
     BOOK LAYOUT (Digital / Print / Both) — single action area
  =================================================================== */
  if (policy.renderMode === "book") {
    type BookMode = "digital" | "print" | "bundle";
    const [mode, setMode] = useState<BookMode>(() => {
      if (selection.wantDigital && selection.wantPrint) return "bundle";
      if (selection.wantPrint) return "print";
      return "digital";
    });

    // Keep selection toggles in sync with the tab
    useEffect(() => {
      if (mode === "digital") {
        selection.setWantDigital(true);
        selection.setWantPrint(false);
      } else if (mode === "print") {
        selection.setWantDigital(false);
        selection.setWantPrint(true);
      } else {
        selection.setWantDigital(true);
        selection.setWantPrint(true);
      }
    }, [mode]); // eslint-disable-line

    return (
      <>
        <DescriptionCard text={product.description} />
        <SaleAndCountdown {...pricing} />
        {bundleWins && (
          <div className="mt-1 text-[11px] sm:text-xs text-emerald-700 font-medium">
            Bundle applied: Digital + Print
          </div>
        )}

        {/* tabs */}
        <div className="mt-4 rounded-2xl ring-1 ring-black/10 bg-white p-4 sm:p-6">
          <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode("digital")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                mode === "digital" ? "bg-white shadow" : "text-gray-600"
              }`}
            >
              Digital
            </button>
            <button
              type="button"
              onClick={() => setMode("print")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                mode === "print" ? "bg-white shadow" : "text-gray-600"
              }`}
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => setMode("bundle")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                mode === "bundle" ? "bg-white shadow" : "text-gray-600"
              }`}
            >
              Both
            </button>
          </div>

          {/* DIGITAL panel */}
          {mode === "digital" && (
            <div className="space-y-6 pt-4">
              {!policy.hide.format && (
                <FormatSelector
                  formats={ctrl.formats}
                  selected={ctrl.format}
                  onChangeAction={ctrl.handleFormatChange}
                  inCart={inCart || null}
                  updateCart={(updates: CartUpdates) =>
                    inCart
                      ? updateCart({
                          productId: product.id,
                          printVariantId: formatData.options.printVariantId,
                          updates,
                        })
                      : undefined
                  }
                />
              )}
              {!policy.hide.license && (
                <LicenseSelectorCore
                  selected={licenseData.license}
                  licenses={licenses}
                  onSelect={ctrl.handleLicenseSelect}
                />
              )}
            </div>
          )}

          {/* PRINT panel */}
          {mode === "print" && (
            <div className="space-y-6 pt-4">
              {!policy.hide.size && (
                <SizeSelectorCore
                  options={availableSizes}
                  selected={sizeData.size}
                  isCustom={sizeData.isCustom}
                  customSize={sizeData.customSize}
                  onSelect={ctrl.handleSizeSelect}
                  onCustomChange={ctrl.handleCustomSizeChange}
                />
              )}
              {/* Books: no material/frame */}
            </div>
          )}

          {/* BOTH panel */}
          {mode === "bundle" && (
            <div className="space-y-8 pt-4">
              <section className="space-y-4">
                <h4 className="font-semibold">Digital</h4>
                {!policy.hide.format && (
                  <FormatSelector
                    formats={ctrl.formats}
                    selected={ctrl.format}
                    onChangeAction={ctrl.handleFormatChange}
                    inCart={inCart || null}
                    updateCart={(updates: CartUpdates) =>
                      inCart
                        ? updateCart({
                            productId: product.id,
                            printVariantId: formatData.options.printVariantId,
                            updates,
                          })
                        : undefined
                    }
                  />
                )}
                {!policy.hide.license && (
                  <LicenseSelectorCore
                    selected={licenseData.license}
                    licenses={licenses}
                    onSelect={ctrl.handleLicenseSelect}
                  />
                )}
              </section>

              {!policy.hide.size && (
                <section className="space-y-4">
                  <h4 className="font-semibold">Print</h4>
                  <SizeSelectorCore
                    options={availableSizes}
                    selected={sizeData.size}
                    isCustom={sizeData.isCustom}
                    customSize={sizeData.customSize}
                    onSelect={ctrl.handleSizeSelect}
                    onCustomChange={ctrl.handleCustomSizeChange}
                  />
                </section>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  /* ==================================================================
     DEFAULT LAYOUT (all other kinds)
  =================================================================== */
  return (
    <>
      <DescriptionCard text={product.description} />
      <SaleAndCountdown {...pricing} />
      {bundleWins && (
        <div className="mt-1 text-[11px] sm:text-xs text-emerald-700 font-medium">
          Bundle applied: Digital + Print
        </div>
      )}

      {/* Allow toggles only if enabled by kind */}
      <PurchaseOptionsCore
        digitalChecked={selection.wantDigital && policy.allow.digital}
        printChecked={selection.wantPrint && policy.allow.print}
        digitalPrice={
          ctrl.digitalPriceStr !== "0.00" ? ctrl.digitalPriceStr : product.price
        }
        printPrice={
          ctrl.printPriceStr !== "0.00" ? ctrl.printPriceStr : product.price
        }
        onToggleDigital={() =>
          policy.allow.digital && ctrl.handleToggleDigital()
        }
        onTogglePrint={() => policy.allow.print && ctrl.handleTogglePrint()}
        allowDigital={policy.allow.digital}
        allowPrint={policy.allow.print}
      />

      {/* DIGITAL controls */}
      <AnimatePresence initial={false}>
        {selection.wantDigital && policy.allow.digital && (
          <motion.div
            key="digital-license"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ overflow: "hidden" }}
          >
            {!policy.hide.license && (
              <LicenseSelectorCore
                selected={licenseData.license}
                licenses={licenses}
                onSelect={ctrl.handleLicenseSelect}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FORMAT (shared) */}
      {showFormat && !policy.hide.format && (
        <FormatSelector
          formats={ctrl.formats}
          selected={ctrl.format}
          onChangeAction={ctrl.handleFormatChange}
          inCart={inCart || null}
          updateCart={(updates: CartUpdates) =>
            updateCart({
              productId: product.id,
              printVariantId: formatData.options.printVariantId,
              updates, // no price
            })
          }
        />
      )}

      {/* PRINT controls */}
      <AnimatePresence initial={false}>
        {selection.wantPrint && policy.allow.print && (
          <motion.div
            key="print-settings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ overflow: "hidden" }}
          >
            {!policy.hide.size && (
              <SizeSelectorCore
                options={availableSizes}
                selected={sizeData.size}
                isCustom={sizeData.isCustom}
                customSize={sizeData.customSize}
                onSelect={ctrl.handleSizeSelect}
                onCustomChange={ctrl.handleCustomSizeChange}
              />
            )}

            <div className="mt-4" />

            {(!policy.hide.material || !policy.hide.frame) && (
              <PrintCustomizerCore
                imageSrc={props.previewImageSrc ?? product.imageUrl}
                materials={materials}
                frames={frames}
                material={materialData.material}
                frame={frameData.frame}
                onMaterial={ctrl.handleMaterial}
                onFrame={ctrl.handleFrame}
                total={finalUnitPrice}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
