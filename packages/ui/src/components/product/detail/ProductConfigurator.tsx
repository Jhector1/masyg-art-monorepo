"use client";

import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import PurchaseOptionsCore from "../shared/core/PurchaseOptionsCore";
import LicenseSelectorCore from "../shared/core/LicenseSelectorCore";
import SizeSelectorCore from "../shared/core/SizeSelectorCore";
import PrintCustomizerCore from "../shared/core/PrintCustomizerCore";
import FormatSelector from "../FormatSelector";

import type {
  ProductDetailResult,
  FrameOption,
  MaterialOption,
  AddOptions,
  LicenseOption,
  CartUpdates,
  CartSelectedItem,
} from "@acme/core/types";
import type { SizeOption } from "../shared/core/SizeSelectorCore";

import { useCart } from "@acme/core/contexts/CartContext";
import { usePurchaseConfigurator } from "@acme/core/hooks/usePurchaseConfigurator";
import { SaleAndCountdown } from "../shared/core/SalePriceAndCountDown";
import { cleanSizes } from "@acme/core/utils/helpers";
import { computeFinalUnitPrice } from "@acme/core/lib/finalize";
import { roundMoney } from "@acme/core/lib/pricing";
import { DescriptionCard } from "../shared/core/DescriptionCard";

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

  // kept for hook API shape; not used directly here
  // calculatePrice: any;
}

export default function ProductConfigurator({
  showFormat = true,
  ...props
}: ProductConfiguratorProps) {
  const { updateCart } = useCart();

  const {
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
    // calculatePrice,
  } = props;

  const availableSizes = cleanSizes(product.sizes);

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

    // calculatePrice,
    inCart,
    updateCart: (input) =>
      updateCart({
        productId: input.productId,
        digitalVariantId: input.digitalVariantId,
        printVariantId: input.printVariantId,
        updates: input.updates, // no price
      }),
    options: formatData?.options,
    setOptions: formatData.setOptions,
  });

  // Unified price (API-identical)
  const sizeString = useMemo(() => {
    if (!selection.wantPrint) return null;
    if (!sizeData.isCustom) return sizeData.size?.label ?? null;
    const w = parseFloat(sizeData.customSize.width || "");
    const h = parseFloat(sizeData.customSize.height || "");
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? `${w}x${h} in`
      : sizeData.size?.label ?? null;
  }, [selection.wantPrint, sizeData.isCustom, sizeData.customSize, sizeData.size?.label]);

  const priceInfo = useMemo(() => {
    const saleStartsAt = product?.saleStartsAt ? new Date(product.saleStartsAt as any) : null;
    const saleEndsAt   = product?.saleEndsAt   ? new Date(product.saleEndsAt as any)   : null;

    return computeFinalUnitPrice({
      productBase: product.price,
      salePrice: (product as any).salePrice ?? null,
      salePercent: (product as any).salePercent ?? null,
      saleStartsAt,
      saleEndsAt,
      format: ctrl.format,
      size: sizeString,
      material: selection.wantPrint ? materialData.material.label : null,
      frame: selection.wantPrint ? frameData.frame?.label ?? null : null,
      license: selection.wantDigital ? licenseData.license.type : null,
      digital: selection.wantDigital
        ? { type: "DIGITAL", format: ctrl.format, license: licenseData.license.type }
        : null,
      print: selection.wantPrint
        ? { type: "PRINT", format: ctrl.format, size: sizeString, material: materialData.material.label, frame: frameData.frame?.label ?? null }
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
  ]);

  const finalUnitPrice = priceInfo.finalUnitPrice;
  const bundleWins =
    selection.wantDigital &&
    selection.wantPrint &&
    priceInfo.priceWithBundle < priceInfo.priceWithSale;

const saleActive = !bundleWins && priceInfo.priceWithSale < priceInfo.baseUnit;
const compareAtForUI = roundMoney(priceInfo.baseUnit);

const pricing = {
  price: finalUnitPrice,
  // ✅ show %-off for both sale and bundle
  compareAt: (bundleWins || saleActive) ? compareAtForUI : null,
  onSale: bundleWins ? true : saleActive,
  // no countdown for bundle
  endsAt: bundleWins ? null : (product?.saleEndsAt ? new Date(product.saleEndsAt as any) : null),
} as const;
// alert(ctrl.digitalPriceStr)
  return (
    <>
      <DescriptionCard text={product.description} />
      <SaleAndCountdown {...pricing} />
      {bundleWins && (
        <div className="mt-1 text-[11px] sm:text-xs text-emerald-700 font-medium">
          Bundle applied: Digital + Print
        </div>
      )}

      <PurchaseOptionsCore
        digitalChecked={selection.wantDigital}
        printChecked={selection.wantPrint}
        digitalPrice={ (ctrl.digitalPriceStr!=='0.00')? ctrl.digitalPriceStr: product.price}
        printPrice={(ctrl.printPriceStr!=='0.00')? ctrl.printPriceStr: product.price}
        onToggleDigital={ctrl.handleToggleDigital}
        onTogglePrint={ctrl.handleTogglePrint}
      />

      <AnimatePresence initial={false}>
        {selection.wantDigital && (
          <motion.div
            key="digital-license"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <LicenseSelectorCore
              selected={licenseData.license}
              licenses={licenses}
              onSelect={ctrl.handleLicenseSelect}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showFormat && (
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

      <AnimatePresence initial={false}>
        {selection.wantPrint && (
          <motion.div
            key="print-settings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <SizeSelectorCore
              options={availableSizes}
              selected={sizeData.size}
              isCustom={sizeData.isCustom}
              customSize={sizeData.customSize}
              onSelect={ctrl.handleSizeSelect}
              onCustomChange={ctrl.handleCustomSizeChange}
            />

            <div className="mt-4" />

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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
