"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import UniversalModal from "../modal/UniversalModal";
import AuthenticationForm from "../authenticate/AuthenticationFom";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";
import { useUser } from "@acme/core/contexts/UserContext";
import type {
  CartSelectedItem,
  ProductListAndOrderCount,
  ProductListItem,
} from "@acme/core/types";
import { useCart } from "@acme/core/contexts/CartContext";
import {originalGalleryMoney,cartGalleryPresentation,type OriginalGalleryItem} from "@acme/core/lib/client/original-ui-catalog";

// Pricing utils
import { applyBundleIfBoth, getEffectiveSale, roundMoney } from "@acme/core/lib/pricing";

interface GalleryProps {
  products:
    | Array<ProductListAndOrderCount>
    | ProductListItem[]
    | Array<CartSelectedItem>
    | OriginalGalleryItem[];
  showCartItem?: boolean;
  showLikeButton?: boolean;
  onLikeToggle?: (id: string, liked: boolean) => void;
  onRemoveCartVariant?: (variantId:string)=>Promise<void>;
}

export default function Gallery({
  products,
  showLikeButton = true,
  onLikeToggle,
  showCartItem = false,
  onRemoveCartVariant,
}: GalleryProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isLoggedIn } = useUser();
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [favoriteError,setFavoriteError] = useState<string|null>(null);
  const router = useRouter();
  const { removeFromCart } = useCart();

  const handleLikeClick = (id: string) => {
    if (!isLoggedIn) {
      setModalOpen(true);
      return;
    }
    const liked = !isFavorite(id);
    setFavoriteError(null);
    void toggleFavorite(id).then(()=>onLikeToggle?.(id,liked))
      .catch(()=>setFavoriteError("Could not update favorites. Please try again."));
  };

  function derivePricing(
    p: ProductListItem | ProductListAndOrderCount | CartSelectedItem | OriginalGalleryItem
  ) {
    const anyP = p as any;
    if(anyP.canonical===true){
      const price=anyP.price as number;
      const currency=anyP.currency as string;
      const compare=Number.isSafeInteger(anyP.compareAtMinor) && anyP.compareAtMinor>anyP.priceMinor
        ?anyP.compareAtMinor/(10**(new Intl.NumberFormat("en-US",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2)):null;
      return {price,compareAt:compare,onSale:compare!==null,endsAt:null,
        pctOff:compare?Math.max(0,Math.round(100*(1-price/compare))):0};
    }
    const base = typeof anyP.price === "number" ? anyP.price : 0;
    const starts = anyP.saleStartsAt ? new Date(anyP.saleStartsAt) : null;
    const ends = anyP.saleEndsAt ? new Date(anyP.saleEndsAt) : null;

    const saleRes = getEffectiveSale({
      price: base,
      salePrice: anyP.salePrice ?? null,
      salePercent: anyP.salePercent ?? null,
      saleStartsAt: starts,
      saleEndsAt: ends,
    });

    const priceWithBundle = applyBundleIfBoth(
      base,
      (p as any).digital,
      (p as any).print
    );
    const priceWithSale = saleRes.price;
    const finalUnitPrice = roundMoney(Math.min(priceWithSale, priceWithBundle));

    const hasBundle = Boolean((p as any).digital && (p as any).print);
    const bundleWins = hasBundle && priceWithBundle < priceWithSale;

    const baseRounded = roundMoney(base);
    const compareAtForUI = bundleWins
      ? baseRounded
      : saleRes.compareAt ?? baseRounded;

    const pricing = {
      price: finalUnitPrice,
      compareAt: bundleWins ? compareAtForUI : saleRes.compareAt ?? null,
      onSale: bundleWins ? true : saleRes.onSale,
      endsAt: bundleWins ? null : saleRes.endsAt,
    } as const;

    const pctOff = pricing.compareAt
      ? Math.max(0, Math.round(100 * (1 - pricing.price / pricing.compareAt)))
      : 0;

    return { ...pricing, pctOff };
  }

  return (
    <>
      <UniversalModal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <AuthenticationForm />
      </UniversalModal>

      {favoriteError&&<p role="alert" className="text-sm text-red-700">{favoriteError}</p>}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mt-8"
  initial={false}          // ✅ important: do NOT render hidden on the server
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
        }}
      >
           {/* <>{JSON.stringify(products)}</> */}

        {products.map((p) => {
          const liked = isFavorite(p.id);
          const original = (p as Partial<OriginalGalleryItem>).canonical===true;
          const slug = original ? (p as OriginalGalleryItem).canonicalSlug : p.id;
          // Product IDs are used for favorite operations; listing slugs are only navigation.
          const href = slug ? `/store/${encodeURIComponent(slug)}` : "/store";
          const imgSrc = getPrimaryImage(p);
          const isCartItem = isCartSelectedItem(p);
          // console.log("Rendering product", p.id, { imgSrc });

          const pricing = derivePricing(p);
          // Cart prices and optional print labels come only from the server-quoted
          // canonical cart projection or a verified variant snapshot.
          const cartDisplay = isCartItem
            ? cartGalleryPresentation(p as CartSelectedItem | OriginalGalleryItem)
            : null;
          const current = cartDisplay?.price ?? pricing.price;
          const compare = cartDisplay ? cartDisplay.compareAt : pricing.compareAt ?? null;
          const discounted = compare != null && current < compare;


          return (
            <motion.div
              key={p.id + (isCartItem ? (p as CartSelectedItem).cartItemId : "")}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
              className="group"
            >
            {/* <>Hello Javascript</> */}

              <div
                className={[
                  // Card shell — neutral, airy, understated
                  "relative rounded-2xl border border-neutral-200 bg-white/80",
                  "shadow-sm hover:shadow-md transition-shadow",
                  "p-3 sm:p-4",
                ].join(" ")}
              >
                {/* Quiet like button */}
                {showLikeButton && (
                  <button
                    onClick={() => handleLikeClick(p.id)}
                    className={[
                      "absolute right-3 top-3 z-10",
                      "inline-flex items-center justify-center rounded-full",
                      "border border-neutral-200 bg-white/70 backdrop-blur-sm",
                      "p-1.5 hover:bg-white transition-colors",
                    ].join(" ")}
                    aria-label="Toggle favorite"
                  >
                    {liked ? (
                      <HeartSolid className="w-4.5 h-4.5 text-neutral-900" />
                    ) : (
                      <HeartOutline className="w-4.5 h-4.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
                    )}
                  </button>
                )}

                {/* Minimal design indicator (tiny dot) */}
                {(("isUserDesignApplied" in p && (p as any).isUserDesignApplied) ||
                  (p as CartSelectedItem).isUserDesign) && (
                  <span className="absolute left-3 top-3 z-10 inline-block h-2 w-2 rounded-full bg-neutral-900/80" />
                )}

                {/* Sale tag (tiny, neutral) */}
                {pricing.onSale && pricing.pctOff > 0 && (
                  <span
                    className={[
                      "absolute left-3 top-3 z-10",
                      "rounded-full bg-neutral-900 text-white",
                      "px-2 py-0.5 text-[10px] font-medium tracking-wide",
                    ].join(" ")}
                  >
                    -{pricing.pctOff}%
                  </span>
                )}

                {/* Image */}
                <div
                  className="relative w-full overflow-hidden rounded-xl bg-neutral-100"
                  onClick={() => router.push(href)}
                >
                  <div className="aspect-[4/5]">
                    <Image
                      key={imgSrc}
                      src={imgSrc}
                      alt={(p as any).title}
                      fill
                      className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      onLoadingComplete={() =>
                        setLoaded((prev) => ({ ...prev, [p.id]: true }))
                      }
                      style={{ opacity: loaded[p.id] ? 1 : 0 }}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      unoptimized
                    />
                  </div>
                  {!loaded[p.id] && (
                    <div className="absolute inset-0 animate-pulse bg-neutral-200/60" />
                  )}
                </div>

                {/* Optional frame tile (cart item) */}
                {isCartItem && !original && cartDisplay?.frame && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">+</span>
                    <div
                      className="relative w-20 sm:w-24 overflow-hidden rounded-lg bg-neutral-100"
                      onClick={() => router.push(href)}
                    >
                      <div className="aspect-square">
                        <Image
                          src={`/images/${cartDisplay.frame.toLowerCase().split(" ").join("-")}.png`}
                          alt={(p as any).title}
                          fill
                          className="object-contain"
                          onLoadingComplete={() =>
                            setLoaded((prev) => ({ ...prev, [p.id]: true }))
                          }
                          style={{ opacity: loaded[p.id] ? 1 : 0 }}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      {cartDisplay.material || ""}
                    </p>
                  </div>
                )}

                {/* Meta + price */}
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <h3
                      onClick={() => router.push(href)}
                      className="cursor-pointer text-[13px] font-medium tracking-wide text-neutral-900 hover:underline"
                    >
                      {(p as any).title}
                    </h3>

                    {"dimensions" in p && (p as any).dimensions && (
                      <p className="text-[11px] text-neutral-500">
                        {(p as any).dimensions}
                      </p>
                    )}

                    {/* Price (quiet strike) */}
                    <p className="text-sm font-medium text-neutral-900">
                      {discounted ? (
                        <>
                          <span>{original?originalGalleryMoney((p as OriginalGalleryItem).priceMinor,(p as OriginalGalleryItem).currency):`$${current.toFixed(2)}`}</span>
                          <span className="ml-2 align-middle text-[12px] text-neutral-400 line-through">
                            {original?originalGalleryMoney((p as OriginalGalleryItem).compareAtMinor!,(p as OriginalGalleryItem).currency):`$${compare!.toFixed(2)}`}
                          </span>
                        </>
                      ) : (
                        <span>{original?originalGalleryMoney((p as OriginalGalleryItem).priceMinor,(p as OriginalGalleryItem).currency):`$${current.toFixed(2)}`}</span>
                      )}
                    </p>

                    {isCartItem && original && cartDisplay?.selection && Object.keys(cartDisplay.selection).length>0 && <p className="text-[11px] text-neutral-500">
                      {Object.entries(cartDisplay.selection).map(([key,value])=>`${key}: ${value}`).join(" · ")}
                    </p>}
                    {/* Variant summary (cart item) */}
                    {isCartItem && (
                      <p className="text-[11px] text-neutral-600">
                        {(p as CartSelectedItem).print ? "Print" : ""}
                        {(p as CartSelectedItem).digital
                          ? (p as CartSelectedItem).print
                            ? " & Digital"
                            : "Digital"
                          : ""}
                      </p>
                    )}

                    {original && !(p as OriginalGalleryItem).available && !isCartItem && (
                      <p className="text-[11px] text-neutral-500">Unavailable</p>
                    )}

                    {"artistName" in p && (p as any).artistName && (
                      <p className="text-[11px] text-neutral-500">
                        {(p as any).artistName}
                      </p>
                    )}

                    {"purchaseCount" in p && typeof (p as any).purchaseCount === "number" && (
                      <p className="text-[11px] text-neutral-400">
                        Purchased: {(p as any).purchaseCount}
                      </p>
                    )}
                  </div>

                  {showCartItem && isCartItem && (
                    <button
                      onClick={async () => {
                        const { digital, print, id,cartItemId } = p as CartSelectedItem;
                        if(onRemoveCartVariant) await onRemoveCartVariant(cartItemId);
                        else await removeFromCart(id, digital?.id ?? "", print?.id ?? "");
                      }}
                      className="text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </>
  );
}

/** Prefer snapshot (user design) > explicit imageUrl > svg preview > first thumbnail */
function getPrimaryImage(
  p: ProductListItem | ProductListAndOrderCount | CartSelectedItem | OriginalGalleryItem
): string {
  const anyP = p as any;
  if (anyP.previewUrl) return anyP.previewUrl;
  if (Array.isArray(anyP.thumbnails) && anyP.thumbnails[0]) return anyP.thumbnails[0];
  if (anyP.imageUrl) return anyP.imageUrl;
  if (anyP.svgPreview) return anyP.svgPreview;
  return "/placeholder.png";
}

/** Narrowing guard that works for both digital-only and print-only cart lines */
function isCartSelectedItem(
  p: ProductListItem | ProductListAndOrderCount | CartSelectedItem | OriginalGalleryItem
): p is CartSelectedItem {
  return !!p && typeof p === "object" && "cartItemId" in p;
}
