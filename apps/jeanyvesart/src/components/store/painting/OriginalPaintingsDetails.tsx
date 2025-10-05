// File: src/components/product/OriginalPaintingDetails.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";
// If you already have a CartContext, prefer that instead of fetch.
// import { useCart } from "@/contexts/CartContext";

type VariantType = "DIGITAL" | "PRINT" | "ORIGINAL";
type InventoryStatus = "ACTIVE" | "RESERVED" | "SOLD";

type Variant = {
  id: string;
  type: VariantType | null;
  status?: InventoryStatus | null;
  inventory?: number | null;
  listPrice?: number | null;

  // painting metadata (optional)
  widthIn?: number | null;
  heightIn?: number | null;
  depthIn?: number | null;
  weightLb?: number | null;
  year?: number | null;
  medium?: string | null;
  surface?: string | null;
  framed?: boolean | null;
  originalSerial?: string | null;
  soldAt?: string | null;

  inUserCart?: boolean;
};

type ApiProduct = {
  id: string;
  category: string | null;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  thumbnails: string[];
  formats: string[];
  svgPreview?: string | null;
  variants: Variant[];
  reviews: any[];
  salePercent?: number | null;
  salePrice?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  sizes: string[];
  userDesign?: {
    id: string;
    previewUrl?: string | null;
    previewPublicId?: string | null;
    previewUpdatedAt?: string | null;
  } | null;
  userDesignPreviewUrl?: string | null;
};

export type OriginalPaintingDetailsProps = {
  productId: string;
  open?: boolean;
  onClose?: () => void;
};

function pickOriginalVariant(vs: Variant[] | undefined) {
  return vs?.find((v) => v.type === "ORIGINAL");
}

function statusChip(status?: InventoryStatus | null) {
  switch (status) {
    case "SOLD": return { label: "Sold", className: "bg-red-50 text-red-700 border-red-200" };
    case "RESERVED": return { label: "Reserved", className: "bg-amber-50 text-amber-700 border-amber-200" };
    default: return { label: "Available", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
}

function fmtInch(n?: number | null) {
  return typeof n === "number" ? `${Number(n.toFixed(2))}″` : "—";
}
function money(n?: number | null) {
  return typeof n === "number" ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";
}

export default function OriginalPaintingDetails({
  productId,
  open = true,
  onClose,
}: OriginalPaintingDetailsProps) {
  const [data, setData] = React.useState<ApiProduct | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // image swap
  const [activeImg, setActiveImg] = React.useState<string | null>(null);
  const [imgFading, setImgFading] = React.useState(false);

  // like + cart optimistic states
  const { isFavorite, toggleFavorite } = useFavorites();
  const [likeBusy, setLikeBusy] = React.useState(false);
  const [cartBusy, setCartBusy] = React.useState(false);
  const [inCart, setInCart] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/products/${productId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = (await res.json()) as ApiProduct;
        if (!alive) return;
        setData(json);
        setActiveImg(json.imageUrl || json.thumbnails?.[0] || "/placeholder.png");
        const ov = pickOriginalVariant(json.variants);
        setInCart(Boolean(ov?.inUserCart));
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [productId, open]);

  const liked = isFavorite(data?.id ?? "");

  // Smooth image swap
  const handleThumbClick = (src: string) => {
    if (!src || src === activeImg) return;
    setImgFading(true);
    // brief fade out, then swap, then fade in
    setTimeout(() => {
      setActiveImg(src);
      requestAnimationFrame(() => {
        setImgFading(false);
      });
    }, 120);
  };

  // Like / Unlike (optimistic)
  const handleToggleLike = async () => {
    if (!data?.id || likeBusy) return;
    setLikeBusy(true);
    const willLike = !liked;
    // optimistic
    toggleFavorite(data.id);
    try {
      const res = await fetch(`/api/favorite${willLike ? "" : `?productId=${data.id}`}`, {
        method: willLike ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: willLike ? JSON.stringify({ productId: data.id }) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      // rollback
      toggleFavorite(data.id);
    } finally {
      setLikeBusy(false);
    }
  };

  // Add / Remove ORIGINAL to/from cart (optimistic)
  const handleCartToggle = async () => {
    if (!data) return;
    const ov = pickOriginalVariant(data.variants);
    if (!ov?.id) return;
    if (cartBusy) return;

    setCartBusy(true);
    const willAdd = !inCart;

    // optimistic
    setInCart(willAdd);
    try {
      if (willAdd) {
        // Adjust to your cart API shape if different.
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: data.id,
            originalVariantId: ov.id,
            quantity: 1,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        // allow either body or query depending on your API
        const res = await fetch(`/api/cart?productId=${data.id}&variantType=ORIGINAL`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(await res.text());
      }
    } catch {
      // rollback
      setInCart(!willAdd);
    } finally {
      setCartBusy(false);
    }
  };

  if (!open) return null;

  return (
    <section className="w-full rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] tracking-wide">
              Original
            </span>
            {data?.variants && (
              <StatusChip variants={data.variants} />
            )}
            {data?.category && (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] tracking-wide">
                {data.category}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
            {data?.title ?? "—"}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Like / Unlike */}
          <button
            onClick={handleToggleLike}
            disabled={likeBusy || !data?.id}
            className="rounded-full border border-neutral-200 bg-white/90 px-3 py-2 transition hover:bg-white"
            aria-label={liked ? "Remove from favorites" : "Add to favorites"}
          >
            {liked ? (
              <HeartSolid className="h-5 w-5 text-neutral-900" />
            ) : (
              <HeartOutline className="h-5 w-5 text-neutral-900" />
            )}
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {loading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-neutral-100" />}
      {error && (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && data && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Image & Thumbs */}
          <div>
            <div
              className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-neutral-200 transition-opacity duration-200 ${
                imgFading ? "opacity-0" : "opacity-100"
              }`}
            >
              {activeImg && (
                <Image
                  key={activeImg} // force re-render for smooth fade
                  src={activeImg}
                  alt={data.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              )}
            </div>

            {!!data.thumbnails?.length && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {data.thumbnails.slice(0, 12).map((src, i) => (
                  <button
                    key={i}
                    onClick={() => handleThumbClick(src)}
                    className={`relative aspect-square overflow-hidden rounded-md border transition ${
                      src === activeImg ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-400"
                    }`}
                    aria-label={`Thumbnail ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`thumb ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Facts */}
          <div className="flex flex-col">
            <PriceBlock data={data} />

            <p className="mt-3 text-[15px] leading-relaxed text-neutral-700">
              {data.description || "No description."}
            </p>

            <PaintingSpecs variants={data.variants} />

            {/* Cart CTA */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleCartToggle}
                disabled={cartBusy || pickOriginalVariant(data.variants)?.status === "SOLD"}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition
                  border ${inCart ? "border-neutral-300 bg-neutral-50 hover:bg-neutral-100" : "border-neutral-900 bg-neutral-900 text-white hover:opacity-90"}`}
              >
                {cartBusy ? "Please wait…" : inCart ? "Remove from Cart" : "Add to Cart"}
              </button>

              {/* Availability echo */}
              <AvailabilityEcho variants={data.variants} />
            </div>

            {/* Reviews summary */}
            <div className="mt-6 text-sm text-neutral-600">
              {Array.isArray(data.reviews) && data.reviews.length > 0
                ? `${data.reviews.length} review${data.reviews.length > 1 ? "s" : ""}`
                : "No reviews yet"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- subcomponents ---------- */

function StatusChip({ variants }: { variants: Variant[] }) {
  const ov = pickOriginalVariant(variants);
  const s = statusChip(ov?.status ?? "ACTIVE");
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide ${s.className}`}>{s.label}</span>;
}

function PriceBlock({ data }: { data: ApiProduct }) {
  const ov = pickOriginalVariant(data.variants);
  const base = ov?.listPrice ?? data.price;
  const onSale = typeof data.salePrice === "number" && data.salePrice < base!;
  return (
    <div className="flex items-end gap-3">
      <div className="text-2xl font-semibold text-neutral-900">{money(onSale ? data.salePrice! : base)}</div>
      {onSale && (
        <>
          <div className="text-sm text-neutral-400 line-through">{money(base)}</div>
          {typeof data.salePercent === "number" && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
              -{data.salePercent}%
            </span>
          )}
        </>
      )}
    </div>
  );
}

function PaintingSpecs({ variants }: { variants: Variant[] }) {
  const v = pickOriginalVariant(variants);
  if (!v) {
    return (
      <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        No original variant found for this product.
      </div>
    );
  }

  const specs: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Dimensions", value: `${fmtInch(v.widthIn)} × ${fmtInch(v.heightIn)} × ${fmtInch(v.depthIn)}` },
    { label: "Year", value: v.year ?? "—" },
    { label: "Medium", value: v.medium ?? "—" },
    { label: "Surface", value: v.surface ?? "—" },
    { label: "Framed", value: v.framed ? "Yes" : "No" },
    { label: "Weight", value: typeof v.weightLb === "number" ? `${v.weightLb} lb` : "—" },
    { label: "Serial / COA", value: v.originalSerial ?? "—" },
    { label: "Inventory", value: typeof v.inventory === "number" ? v.inventory : "—" },
    { label: "Status", value: v.status ?? "ACTIVE" },
  ];

  return (
    <div className="mt-5 rounded-xl border border-neutral-200 p-4">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-neutral-700">Painting details</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {specs.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-neutral-500">{s.label}</dt>
            <dd className="text-[13px] text-neutral-800">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AvailabilityEcho({ variants }: { variants: Variant[] }) {
  const ov = pickOriginalVariant(variants);
  if (!ov) return null;
  const s = statusChip(ov.status ?? "ACTIVE");
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${s.className}`}>
      {s.label}{ov.inventory != null ? ` • ${ov.inventory} in stock` : ""}
    </span>
  );
}
