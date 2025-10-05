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
    setWantDigital,
    wantPrint,
    setWantPrint,
    addToCart,
    removeFromCart,
    handleCheckoutAction,
    loadingAdd,
    preview,
    setPreview,
    // calculatePrice,
    // unified pricing from the hook (API-identical, per unit)
    finalPrice,
    baseUnit,
    priceWithSale,
    priceWithBundle,
  } = useProductData({ productId });

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

            <div className="flex relative flex-col gap-6 w-full">
              {/* <DescriptionCard text={product.description} /> */}

              {/* Optional banner: <SaleAndCountdown {...pricingForBanner} /> */}
              {bundleWins && (
                <div className="mt-1 text-[11px] sm:text-xs text-emerald-700 font-medium">
                  Bundle applied: Digital + Print
                </div>
              )}

              {product.category.toLowerCase() === "spiritual & vodou imagery" &&
                product.svgPreview && (
                  <div className="rounded-2xl ring-1 ring-black/5 bg-white p-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <p className="text-sm text-black/70 text-center sm:text-left">
                        Want different colors or gradients?
                      </p>
                      <button
                        onClick={goCustomize}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                      >
                        ✨ Customize this piece
                      </button>
                    </div>
                  </div>
                )}

              <ProductConfigurator
                showFormat={true}
                product={product}
                inCart={inCart || null}
                materials={allMaterials as MaterialOption[]}
                frames={allFrames as FrameOption[]}
                licenses={allLicenses as LicenseOption[]}
                optionSizes={allSizes}
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
                selection={{
                  wantDigital,
                  setWantDigital,
                  wantPrint,
                  setWantPrint,
                }}
                // calculatePrice={calculatePrice}
              />

              <CartActions
                inCart={Boolean(inCart || null)}
                loading={loadingAdd}
                disabled={!wantDigital && !wantPrint}
                onToggleCart={async () => {
                  if (!isLoggedIn && !guestId) setModalOpen(true);

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
                onCheckout={async () => {
                  const result = await handleCheckoutAction({
                    openUI: false,
                    exportHref: "/account/orders",
                  });
                  if (result?.status !== "ok") return;

                  await new Promise((r) => requestAnimationFrame(r));
                  if (result?.flow === "embedded") {
                    window.dispatchEvent(
                      new CustomEvent("open-checkout", {
                        detail: {
                          clientSecret: result.clientSecret,
                          exportHref: "/account/orders",
                        },
                      })
                    );
                  } else if (result.flow === "redirect") {
                    window.location.href = result.url;
                  } else if (result.flow === "sessionId") {
                    const stripe = await import("@stripe/stripe-js").then((m) =>
                      m.loadStripe(
                        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
                      )
                    );
                    await stripe?.redirectToCheckout({
                      sessionId: result.sessionId,
                    });
                  }
                }}
              />
            </div>
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
