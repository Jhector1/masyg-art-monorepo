"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ScreenshotGuard from "@acme/ui/components/ScreenshotGuard";

import ProductImageGallery from "@acme/ui/components/product/detail/ProductImageGallery";
import ProductConfigurator from "@acme/ui/components/product/detail/ProductConfigurator";
import UniversalModal from "@acme/ui/components/modal/UniversalModal";
import AuthenticationForm from "@acme/ui/components/authenticate/AuthenticationFom";
import CartActions from "@acme/ui/components/product/CartActions";
import ReviewsSection from "@acme/ui/components/product/review/ReviewSection";
// import { DescriptionCard } from "@/components/product/shared/core/DescriptionCard";

import type {
  MaterialOption,
  FrameOption,
  LicenseOption,
} from "@acme/core/types";
import {
  allFrames,
  allLicenses,
  allMaterials,
  allSizes,
} from "@acme/core/data/helpers";
import { useUser } from "@acme/core/contexts/UserContext";
import { useProductData } from "@acme/ui/components/studio/hooks/useProductData";
import { roundMoney } from "@acme/core/lib/pricing";
import { KindInfoPanel } from "../../../components/KindInfoPanel";
interface ProductDetailProps {
  productId: string;
  showProduct?: boolean;
  showReviews?: boolean;
}

export default function ProductDetail({
  productId,
  showReviews = true,
  showProduct = true,
}: ProductDetailProps) {
  const { isLoggedIn, guestId } = useUser();
  const [isModalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const {
    product,
    inCart,
    options,
    setOptions,
    size,
    setSize,
    customSize,
    setCustomSize,
    isCustom,
    setIsCustom,
    material,
    setMaterial,
    frame,
    setFrame,
    license,
    setLicense,
    wantDigital,
  
    wantPrint,
  
    addToCart,
    removeFromCart,

    preview,
    setPreview,
    // calculatePrice,
    // unified pricing from the hook (API-identical, per unit)
    finalPrice,
    baseUnit,
    priceWithSale,
    priceWithBundle,
  } = useProductData({ productId });
  console.log(product)

  const loadingUI = <div className="p-10 text-center">Loading product…</div>;

  // Sale / bundle flags for UI
  const bundleWins = useMemo(
    () => wantDigital && wantPrint && priceWithBundle < priceWithSale,
    [wantDigital, wantPrint, priceWithBundle, priceWithSale]
  );
  const saleActive = useMemo(
    () => !bundleWins && priceWithSale < baseUnit,
    [bundleWins, priceWithSale, baseUnit]
  );

  const pricingForBanner = useMemo(
    () => ({
      price: finalPrice,
      compareAt: saleActive ? roundMoney(baseUnit) : null,
      onSale: bundleWins ? true : saleActive,
      endsAt:
        bundleWins || !product?.saleEndsAt
          ? null
          : new Date(product.saleEndsAt as any),
    }),
    [finalPrice, saleActive, baseUnit, bundleWins, product?.saleEndsAt]
  );

  const goCustomize = () => {
    if (!productId) return;
    router.push(`${encodeURIComponent(String(productId))}/studio`);
  };

  return (
    <>
      <UniversalModal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
        <AuthenticationForm
          onSuccess={() => setModalOpen(false)}
          isGuest={true}
          handlerAction={async () => {
            if (!isLoggedIn && !guestId) setModalOpen(true);
            if (!product) return;

            // Do not send price; server recomputes
            if (!inCart) {
              await addToCart(
                productId,
                wantDigital ? "Digital" : null,
                wantPrint ? "Print" : null,
                product.formats[0]?.split(".").pop() || "",
                size?.label ?? null,
                material.label,
                frame?.label ?? null,
                license.type,
                1
              );
            } else {
              await removeFromCart(
                product.id,
                options.digitalVariantId!,
                options.printVariantId!
              );
            }
          }}
        />
      </UniversalModal>

      {!product ? (
        loadingUI
      ) : (
        <main className="max-w-7xl mx-auto pt-10 lg:pt-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            {/* <ScreenshotGuard blurAmount="10px" blurDurationMs={1500}> */}

            {showProduct && (
              <ProductImageGallery
                product={product}
                preview={preview}
                setPreview={setPreview}
              />
            )}
            {/* </ScreenshotGuard> */}

            {/* info section  */}
            <KindInfoPanel product={product} />

          
          </div>

          <div className="mt-14">
            {showReviews && <ReviewsSection productId={product.id} />}
          </div>
        </main>
      )}

      {/* JSON-LD: reflect unified price */}
      {product && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: product.title,
              image: product.thumbnails ?? [],
              description: product.description,
              sku: product.id,
              offers: {
                "@type": "Offer",
                priceCurrency: "USD",
                price: Number(finalPrice).toFixed(2),
                ...(saleActive && product.saleEndsAt
                  ? {
                      priceValidUntil: new Date(
                        product.saleEndsAt as any
                      ).toISOString(),
                    }
                  : {}),
                availability: "https://schema.org/InStock",
                url: `/store/${product.id}`,
              },
            }),
          }}
        />
      )}
    </>
  );
}
