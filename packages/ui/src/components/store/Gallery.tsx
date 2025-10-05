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

// Pricing utils
import { applyBundleIfBoth, getEffectiveSale, roundMoney } from "@acme/core/lib/pricing";

interface GalleryProps {
  products:
    | Array<ProductListAndOrderCount>
    | ProductListItem[]
    | Array<CartSelectedItem>;
  showCartItem?: boolean;
  showLikeButton?: boolean;
  onLikeToggle?: (id: string, liked: boolean) => void;
}

export default function Gallery({
  products,
  showLikeButton = true,
  onLikeToggle,
  showCartItem = false,
}: GalleryProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isLoggedIn } = useUser();
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const { removeFromCart } = useCart();

  const handleLikeClick = (id: string) => {
    if (!isLoggedIn) {
      setModalOpen(true);
      return;
    }
    const liked = !isFavorite(id);
    toggleFavorite(id);
    onLikeToggle?.(id, liked);
  };

  function derivePricing(
    p: ProductListItem | ProductListAndOrderCount | CartSelectedItem
  ) {
    const anyP = p as any;
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

      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mt-8"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
        }}
      >
        {products.map((p) => {
          const liked = isFavorite(p.id);
          const imgSrc = getPrimaryImage(p);
          const isCartItem = isCartSelectedItem(p);

          const pricing = derivePricing(p);
          const current = isCartItem ? (p as CartSelectedItem).price : pricing.price;
          const compare = isCartItem
            ? (p as CartSelectedItem).originalPrice
            : pricing.compareAt ?? null;
          const discounted = compare != null && current < compare;

          return (
            <motion.div
              key={p.id + (isCartItem ? (p as CartSelectedItem).previewUrl ?? "" : "")}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              className="group"
            >
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
                  onClick={() => router.push(`/store/${p.id}`)}
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
                {isCartItem && (p as CartSelectedItem).print?.frame && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">+</span>
                    <div
                      className="relative w-20 sm:w-24 overflow-hidden rounded-lg bg-neutral-100"
                      onClick={() => router.push(`/store/${p.id}`)}
                    >
                      <div className="aspect-square">
                        <Image
                          src={`/images/${(p as CartSelectedItem)
                            .print!.frame!.toLowerCase()
                            .split(" ")
                            .join("-")}.png`}
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
                      {(p as CartSelectedItem).print?.material || ""}
                    </p>
                  </div>
                )}

                {/* Meta + price */}
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <h3
                      onClick={() => router.push(`/store/${p.id}`)}
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
                          <span>${current.toFixed(2)}</span>
                          <span className="ml-2 align-middle text-[12px] text-neutral-400 line-through">
                            ${compare!.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span>${current.toFixed(2)}</span>
                      )}
                    </p>

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
                        const { digital, print, id } = p as CartSelectedItem;
                        await removeFromCart(id, digital?.id ?? "", print?.id ?? "");
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
  p: ProductListItem | ProductListAndOrderCount | CartSelectedItem
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
  p: ProductListItem | ProductListAndOrderCount | CartSelectedItem
): p is CartSelectedItem {
  return !!p && typeof p === "object" && "cartItemId" in p;
}
