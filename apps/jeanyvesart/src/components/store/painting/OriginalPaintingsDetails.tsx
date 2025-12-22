// File: src/components/product/OriginalPaintingDetails.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";
import { useUser } from "@acme/core/contexts/UserContext";

import type { ProductReviewDTO } from "@acme/core/utils/reviewsClient";
import {
  getProductReviews,
  addProductReview,
  deleteProductReview, // (optional if you add a delete button in UI)
} from "@acme/core/utils/reviewsClient";

type VariantType = "DIGITAL" | "PRINT" | "ORIGINAL";
type InventoryStatus = "ACTIVE" | "RESERVED" | "SOLD";

type Variant = {
  id: string;
  type: VariantType | null;
  status?: InventoryStatus | null;
  inventory?: number | null;
  listPrice?: number | null;

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
    case "SOLD":
      return {
        label: "Sold",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    case "RESERVED":
      return {
        label: "Reserved",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    default:
      return {
        label: "Available",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
  }
}

function fmtInch(n?: number | null) {
  return typeof n === "number" ? `${Number(n.toFixed(2))}″` : "—";
}
function money(n?: number | null) {
  return typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";
}
function clampRating(n: number) {
  if (Number.isNaN(n)) return 5;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export default function OriginalPaintingDetails({
  productId,
  open = true,
  onClose,
}: OriginalPaintingDetailsProps) {
  const router = useRouter();

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
  const [checkoutBusy, setCheckoutBusy] = React.useState(false);
  const [inCart, setInCart] = React.useState<boolean>(false);

  // ✅ REVIEWS (from client service)
  const [reviews, setReviews] = React.useState<ProductReviewDTO[]>([]);
  const [reviewsLoading, setReviewsLoading] = React.useState(false);

  // reviews form state (aligns with your API: rating + text)
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const [reviewForm, setReviewForm] = React.useState({ rating: 5, text: "" });
  const { user } = useUser(); // assumes user?.id exists

  const [deleteBusyId, setDeleteBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // product
        const res = await fetch(`/api/products/${productId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = (await res.json()) as ApiProduct;
        if (!alive) return;

        setData(json);
        setActiveImg(
          json.imageUrl || json.thumbnails?.[0] || "/placeholder.png"
        );
        const ov = pickOriginalVariant(json.variants);
        setInCart(Boolean(ov?.inUserCart));

        // ✅ reviews (separate endpoint via client service)
        setReviewsLoading(true);
        try {
          const rs = await getProductReviews(productId);
          if (alive) setReviews(rs);
        } catch {
          if (alive) setReviews([]);
        } finally {
          if (alive) setReviewsLoading(false);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [productId, open]);

  const liked = isFavorite(data?.id ?? "");
  const ov = React.useMemo(
    () => pickOriginalVariant(data?.variants),
    [data?.variants]
  );
  const isUnavailable = ov?.status === "SOLD" || ov?.status === "RESERVED";

  const avgRating = React.useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((a, r) => a + (Number(r.rating) || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  const handleThumbClick = (src: string) => {
    if (!src || src === activeImg) return;
    setImgFading(true);
    setTimeout(() => {
      setActiveImg(src);
      requestAnimationFrame(() => setImgFading(false));
    }, 120);
  };

  const handleToggleLike = async () => {
    if (!data?.id || likeBusy) return;
    if (isUnavailable) return;
    setLikeBusy(true);
    const willLike = !liked;

    toggleFavorite(data.id);
    try {
      const res = await fetch(
        `/api/favorite${willLike ? "" : `?productId=${data.id}`}`,
        {
          method: willLike ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: willLike ? JSON.stringify({ productId: data.id }) : undefined,
        }
      );
      if (!res.ok) throw new Error(await res.text());
    } catch {
      toggleFavorite(data.id);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!reviewId || deleteBusyId) return;

    // optimistic remove
    const prev = reviews;
    setDeleteBusyId(reviewId);
    setReviews((cur) => cur.filter((r) => r.id !== reviewId));

    try {
      await deleteProductReview(productId, reviewId);
    } catch (err: any) {
      // rollback on failure
      setReviews(prev);
      setReviewError(err?.message || "Failed to delete review.");
    } finally {
      setDeleteBusyId(null);
    }
  };

  async function addOriginalToCart(): Promise<string | null> {
    if (!data || !ov?.id) throw new Error("Missing product/original variant");

    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: data.id,
        originalVariantId: ov.id,
        quantity: 1,
        originalType: "ORIGINAL",
        site: "JEANYVES", // safe even if backend ignores
      }),
    });

    if (!res.ok) throw new Error(await res.text());

    // If your cart route returns the created item, grab it
    const json = await res.json().catch(() => null);
    const createdId =
      json?.cartItem?.id ??
      json?.item?.id ??
      json?.id ??
      json?.cartItemId ??
      null;

    return typeof createdId === "string" ? createdId : null;
  }

  async function removeOriginalFromCart() {
    if (!data || !ov?.id) throw new Error("Missing product/original variant");
    const res = await fetch(`/api/cart`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: data.id,
        originalVariantId: ov.id,
        quantity: 1,
        originalType: "ORIGINAL",
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  const handleCartToggle = async () => {
    if (!data || !ov?.id || cartBusy) return;
    if (isUnavailable) return;

    setCartBusy(true);
    const willAdd = !inCart;

    setInCart(willAdd);
    try {
      if (willAdd) await addOriginalToCart();
      else await removeOriginalFromCart();
    } catch {
      setInCart(!willAdd);
    } finally {
      setCartBusy(false);
    }
  };
  const handleCheckoutNow = async () => {
    if (!data || !ov?.id || checkoutBusy) return;

    if (isUnavailable) return;

    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cartProductList: [
            {
              productId: data.id,
              originalVariantId: ov.id,
              quantity: 1,
            },
          ],
        }),
      });

      const out = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(out?.message ?? out?.error ?? "Checkout failed");

      window.location.href = out.url;
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Checkout failed");
    } finally {
      setCheckoutBusy(false);
    }
  };

  // ✅ submit review using client service (POST expects {rating, text})
  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.id) return;

    setReviewBusy(true);
    setReviewError(null);

    const payload = {
      rating: clampRating(reviewForm.rating),
      text: reviewForm.text.trim(),
    };

    if (!payload.text) {
      setReviewError("Please write a short review.");
      setReviewBusy(false);
      return;
    }

    try {
      const created = await addProductReview(productId, payload);
      setReviews((prev) => [created, ...prev]);
      setReviewForm({ rating: 5, text: "" });
      setReviewOpen(false);
    } catch (err: any) {
      setReviewError(err?.message || "Failed to submit review.");
    } finally {
      setReviewBusy(false);
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
            {data?.variants && <StatusChip variants={data.variants} />}
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
          {!isUnavailable && (
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
          )}

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

      {loading && (
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-neutral-100" />
      )}
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
                  key={activeImg}
                  src={activeImg}
                  alt={data.title}
                  fill
                  className="object-contain"
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
                      src === activeImg
                        ? "border-neutral-900"
                        : "border-neutral-200 hover:border-neutral-400"
                    }`}
                    aria-label={`Thumbnail ${i + 1}`}
                  >
                    <img
                      src={src}
                      alt={`thumb ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
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

            {/* Cart + Checkout CTA */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!isUnavailable ? (
                <>
                  <button
                    onClick={handleCartToggle}
                    disabled={cartBusy}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition border ${
                      inCart
                        ? "border-neutral-300 bg-neutral-50 hover:bg-neutral-100"
                        : "border-neutral-900 bg-neutral-900 text-white hover:opacity-90"
                    }`}
                  >
                    {cartBusy
                      ? "Please wait…"
                      : inCart
                        ? "Remove from Cart"
                        : "Add to Cart"}
                  </button>

                  <button
                    onClick={handleCheckoutNow}
                    disabled={checkoutBusy}
                    className="rounded-xl border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                  >
                    {checkoutBusy ? "Starting checkout…" : "Checkout now"}
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-700">
                  This piece is currently <b>{ov?.status?.toLowerCase()}</b> and
                  can’t be purchased right now.
                </div>
              )}

              <AvailabilityEcho variants={data.variants} />
            </div>

            {/* ✅ Reviews (from service) */}
            <div className="mt-6 rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Stars value={avgRating} />
                    <span className="text-sm text-neutral-700">
                      {reviewsLoading
                        ? "Loading reviews…"
                        : reviews.length
                          ? `${avgRating.toFixed(1)} • ${reviews.length} review${reviews.length > 1 ? "s" : ""}`
                          : "No reviews yet"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Share your experience with this original.
                  </p>
                </div>

                <button
                  onClick={() => setReviewOpen((v) => !v)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm hover:bg-neutral-100"
                >
                  {reviewOpen ? "Close" : "Write a review"}
                </button>
              </div>

              {reviewOpen && (
                <form onSubmit={submitReview} className="mt-4 grid gap-3">
                  {reviewError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                      {reviewError}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-neutral-700">Rating</label>
                    <StarPicker
                      value={reviewForm.rating}
                      onChange={(v) =>
                        setReviewForm((s) => ({ ...s, rating: v }))
                      }
                    />
                  </div>

                  <textarea
                    value={reviewForm.text}
                    onChange={(e) =>
                      setReviewForm((s) => ({ ...s, text: e.target.value }))
                    }
                    className="min-h-[96px] rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Write your review…"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={reviewBusy}
                      className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {reviewBusy ? "Submitting…" : "Submit review"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewOpen(false)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {reviews.length > 0 && (
                <div className="mt-4 space-y-3">
                  {reviews.slice(0, 6).map((r) => {
                    const canDelete = !!user?.id && user.id === r.userId;

                    return (
                      <div
                        key={r.id}
                        className="rounded-lg border border-neutral-200 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Stars value={r.rating} />
                            <span className="text-sm font-medium text-neutral-900">
                              {r.user}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">
                              {r.date}
                            </span>

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReview(r.id)}
                                disabled={deleteBusyId === r.id}
                                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                                aria-label="Delete review"
                                title="Delete review"
                              >
                                {deleteBusyId === r.id ? "Deleting…" : "Delete"}
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="mt-2 text-sm text-neutral-700">
                          {r.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- subcomponents (unchanged) ---------- */

function StatusChip({ variants }: { variants: Variant[] }) {
  const ov = pickOriginalVariant(variants);
  const s = statusChip(ov?.status ?? "ACTIVE");
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function PriceBlock({ data }: { data: ApiProduct }) {
  const ov = pickOriginalVariant(data.variants);
  const base = ov?.listPrice ?? data.price;
  const onSale =
    typeof data.salePrice === "number" && base != null && data.salePrice < base;
  return (
    <div className="flex items-end gap-3">
      <div className="text-2xl font-semibold text-neutral-900">
        {money(onSale ? data.salePrice! : base)}
      </div>
      {onSale && (
        <>
          <div className="text-sm text-neutral-400 line-through">
            {money(base)}
          </div>
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
    {
      label: "Dimensions",
      value: `${fmtInch(v.widthIn)} × ${fmtInch(v.heightIn)} × ${fmtInch(v.depthIn)}`,
    },
    { label: "Year", value: v.year ?? "—" },
    { label: "Medium", value: v.medium ?? "—" },
    { label: "Surface", value: v.surface ?? "—" },
    { label: "Framed", value: v.framed ? "Yes" : "No" },
    {
      label: "Weight",
      value: typeof v.weightLb === "number" ? `${v.weightLb} lb` : "—",
    },
    { label: "Serial / COA", value: v.originalSerial ?? "—" },
    {
      label: "Inventory",
      value: typeof v.inventory === "number" ? v.inventory : "—",
    },
    { label: "Status", value: v.status ?? "ACTIVE" },
  ];

  return (
    <div className="mt-5 rounded-xl border border-neutral-200 p-4">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-neutral-700">
        Painting details
      </h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {specs.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-neutral-500">
              {s.label}
            </dt>
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
      {s.label}
      {ov.inventory != null ? ` • ${ov.inventory} in stock` : ""}
    </span>
  );
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value || 0));
  const full = Math.floor(v);
  const empty = 5 - full;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Rating ${v.toFixed(1)} out of 5`}
    >
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f${i}`} className="text-yellow-500">
          ★
        </span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="text-neutral-300">
          ★
        </span>
      ))}
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const v = clampRating(value);
  return (
    <div className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        const active = n <= v;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="rounded px-1 py-0.5 text-lg"
            aria-label={`${n} star`}
          >
            <span className={active ? "text-yellow-500" : "text-neutral-300"}>
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}
