// File: src/components/store/ProductCardOriginal.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import {
  Product,
  originalVariant,
  availability,
  dims,
  money,
} from "@/lib/products";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";


type Props = {
  product: Product;
  href?: string;                  // optional details page
  isFavorite?: boolean;
  busy?: boolean;
  // onToggleFavorite?: (id: string) => void; // if provided, shows the heart
};

export default function ProductCardOriginal({
  product: p,
  href,
  // isFavorite = false,
  busy = false,
  // onToggleFavorite,
}: Props) {
  const img = p.thumbnails?.[0] ?? "";
  const v = originalVariant(p);
  const price = v?.listPrice ?? p.price;
  const { label, tone } = availability(v);
  const { isFavorite, toggleFavorite } = useFavorites();
 const liked = isFavorite(p.id);
  const handleLikeClick = (id: string) => {
    // if (!isLoggedIn) {
    //   // setModalOpen(true);
    //   return;
    // }
    const liked = !isFavorite(id);
    toggleFavorite(id);
    // onLikeToggle?.(id, liked);
  };
  const CardInner = (
    <div
      className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50
                 transition-all duration-300 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)]
                 group-hover:-translate-y-0.5"
      style={{ padding: "14px" }}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl">
        <div className="absolute inset-0 animate-pulse bg-neutral-100" />
        {img && (
          <Image
            src={img}
            alt={p.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        )}
      </div>

      {/* chips */}
      <div className="absolute left-[14px] bottom-[14px] flex items-center gap-2">
        <span className="rounded-full bg-white/90 border border-neutral-200 text-[11px] px-2.5 py-1 tracking-wide text-neutral-700">
          Original
        </span>
        <span className={`rounded-full bg-white/90 border border-neutral-200 text-[11px] px-2.5 py-1 tracking-wide ${tone}`}>
          {label}
        </span>
      </div>

      {/* heart (optional) */}
      {/* {onToggleFavorite && ( */}
        <button
          aria-label={liked ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => { e.preventDefault(); handleLikeClick(p.id); }}
          disabled={busy}
          className="absolute right-[12px] top-[12px] rounded-full bg-white/85 backdrop-blur px-2.5 py-2 border border-neutral-200 hover:bg-white transition"
        >
          {liked ? (
            <HeartSolid className="h-5 w-5 text-neutral-900" />
          ) : (
            <HeartOutline className="h-5 w-5 text-neutral-900" />
          )}
        </button>
      {/* )} */}
    </div>
  );

  return (
    <article className="group relative">
      {href ? (
        <Link href={href} className="block focus:outline-none">
          {CardInner}
        </Link>
      ) : (
        CardInner
      )}

      <div className="mt-3">
        <h3 className="text-[15px] md:text-[16px] text-neutral-900 tracking-tight">{p.title}</h3>
        {dims(v) && <div className="mt-1 text-[12px] text-neutral-500">{dims(v)}</div>}
        <div className="mt-2 text-[14px] text-neutral-900">{money(price)}</div>
      </div>
    </article>
  );
}
