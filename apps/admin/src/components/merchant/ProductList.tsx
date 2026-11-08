"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { field, money, productHref, secondary, Status } from "./shared";

export type ProductSummary = {
  slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  product: { id: string; title: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    media: { asset: { id: string; mimeType: string } }[];
    variants: { id: string; name: string; currency: string; priceMinor: number; fulfillment: string }[];
  };
};
export default function ProductList({ store, listings }: { store: StoreChoice; listings: ProductSummary[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const shown = useMemo(() => listings.filter(x => {
    const text = `${x.product.title} ${x.product.description} ${x.slug}`.toLowerCase();
    return text.includes(search.toLowerCase().trim()) && (filter === "ALL" || x.status === filter);
  }), [listings, search, filter]);
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Product library</h2><p className="mt-1 text-sm text-zinc-500">{listings.length} recent listings in {store.storeName}</p></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]"><label className="text-sm font-medium">Search<input className={field} type="search" value={search} placeholder="Search title, description or URL slug" onChange={e => setSearch(e.target.value)} /></label><label className="text-sm font-medium">Listing status<select className={field} value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label></div>
    <div className="mt-5 grid gap-3">{shown.map(x => {
      const image = x.product.media[0]?.asset.id;
      return <article key={x.product.id} className="flex flex-wrap gap-4 rounded-xl border border-zinc-200 p-4 hover:border-zinc-300 sm:flex-nowrap">
        <Link className="block h-28 w-28 shrink-0 overflow-hidden rounded-xl border bg-amber-50 text-center text-zinc-400" href={productHref(store.storeId, x.product.id)} aria-label={`Edit ${x.product.title}`}>
          {image ? <img className="h-full w-full object-cover" alt={`Cover for ${x.product.title}`} src={`/api/merchant/organizations/${store.organizationId}/products/${x.product.id}/media/${image}?size=thumb`} /> : <span className="grid h-full place-items-center text-3xl">▧</span>}
        </Link>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{x.product.title}</h3><Status value={x.status} /></div><p className="mt-1 line-clamp-2 text-sm text-zinc-600">{x.product.description || "No description"}</p><p className="mt-2 text-xs text-zinc-400">/{x.slug}</p><p className="mt-2 text-sm text-zinc-600">{x.product.variants.map(v => `${v.name}: ${money(v.priceMinor, v.currency)}`).join(" · ")}</p><Link className={`${secondary} mt-3`} href={productHref(store.storeId, x.product.id)}>Edit product & media</Link></div>
      </article>;
    })}{!shown.length && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-zinc-500">No matching products</div>}</div>
    <p className="mt-4 text-xs text-zinc-500">This screen currently lists the 50 most recently updated store listings. Full server-side pagination is planned.</p>
  </section>;
}
