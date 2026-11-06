"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  catalogMediaPath, fetchPublishedListings, fetchPublishedStore, formatCatalogPrice,
  visibleVariants, type PublicCatalogItem,
} from "@acme/core/lib/public-catalog-view";

type Focus = "ALL" | "ORIGINAL";
type Filter = "ALL" | "PHYSICAL" | "DIGITAL";
export type PublicCatalogProps = {
  heading: string;
  subtitle?: string;
  focus?: Focus;
  limit?: number;
  compact?: boolean;
};

/** No global Product query, unsanitized product id, or browser-supplied organization ID. */
export default function PublicCatalog({
  heading, subtitle, focus = "ALL", limit = 50, compact = false,
}: PublicCatalogProps) {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<PublicCatalogItem[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const context = await fetchPublishedStore(ctrl.signal);
        const catalog = await fetchPublishedListings(context.store.id, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (catalog.store.id !== context.store.id) throw new Error("Storefront mismatch");
        setStoreId(context.store.id);
        setItems(catalog.products);
      } catch (reason) {
        if (!ctrl.signal.aborted) setError(reason instanceof Error ? reason.message : "Storefront unavailable");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const products = useMemo(() => items.filter(item => {
    const variants = visibleVariants(item, focus);
    return variants.length > 0 && (filter === "ALL" || variants.some(v => v.fulfillment === filter));
  }).slice(0, limit), [items, focus, filter, limit]);

  return <section className={compact ? "w-full" : "mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 lg:py-16"}>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-neutral-900 sm:text-3xl">{heading}</h1>
        {subtitle && <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {focus === "ALL" && <div className="flex gap-2" aria-label="Filter product fulfillment">
        {(["ALL", "PHYSICAL", "DIGITAL"] as const).map(value =>
          <button key={value} type="button" onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full border px-4 py-2 text-sm transition ${filter === value
              ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}>
            {value === "ALL" ? "All" : value === "PHYSICAL" ? "Physical" : "Digital"}
          </button>
        )}
      </div>}
    </div>
    {loading && <p role="status" className="py-12 text-neutral-500">Loading artworks…</p>}
    {!loading && error && <p role="alert" className="py-12 text-red-700">{error}. Check the published storefront and verified domain mapping.</p>}
    {!loading && !error && products.length === 0 &&
      <p className="py-16 text-center text-neutral-500">No published artworks available in this category.</p>}
    {!loading && !error && storeId && <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-7">
      {products.map(item => {
        const variants = visibleVariants(item, focus).filter(v => filter === "ALL" || v.fulfillment === filter);
        const lowest = variants.filter(v => v.available).sort((a,b) => a.priceMinor - b.priceMinor)[0]
          ?? [...variants].sort((a,b) => a.priceMinor - b.priceMinor)[0];
        const preview = item.product.publicMedia[0];
        const image = preview ? catalogMediaPath(storeId, preview.assetId) : null;
        return <article key={item.slug} className="group min-w-0">
          <Link href={`/store/${encodeURIComponent(item.slug)}`} className="block" aria-label={`View ${item.product.title}`}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 shadow-sm transition group-hover:shadow-md">
              {image ? <img src={image} alt={preview?.altText || item.product.title}
                loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"/>
                : <span className="flex h-full items-center justify-center text-xs text-neutral-400">Preview unavailable</span>}
            </div>
            <h2 className="mt-3 line-clamp-2 text-sm font-medium tracking-wide text-neutral-900 group-hover:underline">{item.product.title}</h2>
            <div className="mt-1 text-xs text-neutral-500">
              {focus === "ORIGINAL" ? "Original artwork" : variants.map(v => v.fulfillment === "PHYSICAL" ? "Physical" : "Digital").filter((v,i,a) => a.indexOf(v) === i).join(" · ")}
            </div>
            <p className="mt-1 text-sm text-neutral-900">{lowest ? formatCatalogPrice(lowest.priceMinor, lowest.currency) : "Unavailable"}</p>
          </Link>
        </article>;
      })}
    </div>}
  </section>;
}
