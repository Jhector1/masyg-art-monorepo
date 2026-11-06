"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  catalogMediaPath, fetchPublishedListing, fetchPublishedStore, formatCatalogPrice,
  visibleVariants, type PublicCatalogDetail, type PublicVariant,
} from "@acme/core/lib/public-catalog-view";
import {
  availablePublicVariantById, isPublicPrintVariant, publicPrintVariantLabel,
  sortedPublicPrintVariants,
} from "@acme/core/lib/public-print-variants";

type Props = {slug: string; originalsOnly?: boolean};

export default function PublicProductDetail({slug, originalsOnly = false}: Props) {
  const [detail, setDetail] = useState<PublicCatalogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true); setError(null); setMessage(null); setDetail(null);
    void (async () => {
      try {
        const context = await fetchPublishedStore(ctrl.signal);
        const found = await fetchPublishedListing(context.store.id, slug, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (context.store.id !== found.store.id || found.slug !== slug) throw new Error("Storefront mismatch");
        const permitted = visibleVariants(found, originalsOnly ? "ORIGINAL" : "ALL");
        if (!permitted.length) throw new Error("This artwork is not currently available in this collection");
        setDetail(found);
        setSelected(permitted.find(v => v.available)?.id ?? permitted[0].id);
      } catch (reason) {
        if (!ctrl.signal.aborted) setError(reason instanceof Error ? reason.message : "Artwork unavailable");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [slug, originalsOnly]);

  const variants = detail ? sortedPublicPrintVariants(visibleVariants(detail, originalsOnly ? "ORIGINAL" : "ALL")) : [];
  const active = variants.find(v => v.id === selected) ?? null;
  const media = detail?.product.publicMedia ?? [];

  async function addVariant(variant: PublicVariant) {
    if (!detail || busy || !availablePublicVariantById(variants, variant.id)) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/public/stores/${encodeURIComponent(detail.store.id)}/cart`, {
        method: "POST", credentials: "same-origin",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({variantId: variant.id, quantity}),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const reason = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `Cart failed (${response.status})`;
        throw new Error(reason);
      }
      setMessage("Added to cart. Your cart is updated using current storefront pricing.");
    } catch (reason) {setMessage(reason instanceof Error ? reason.message : "Unable to add to cart");}
    finally {setBusy(false);}
  }

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:py-16">
    <Link href="/store" className="text-sm text-neutral-500 hover:text-neutral-900">← Back to gallery</Link>
    {loading && <p role="status" className="mt-10 text-neutral-500">Loading artwork…</p>}
    {!loading && error && <p role="alert" className="mt-10 text-red-700">{error}</p>}
    {detail && <div className="mt-8 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="space-y-3">
        {media.length ? media.map(preview =>
          <div key={preview.assetId} className="aspect-[4/5] overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
            <img src={catalogMediaPath(detail.store.id,preview.assetId)} alt={preview.altText || detail.product.title}
              className="h-full w-full object-contain" loading="lazy"/>
          </div>
        ) : <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-neutral-50 text-neutral-500">Preview unavailable</div>}
      </div>
      <section>
        <h1 className="text-3xl font-medium tracking-tight text-neutral-900">{detail.product.title}</h1>
        {detail.product.description && <p className="mt-5 whitespace-pre-line text-sm leading-7 text-neutral-600">{detail.product.description}</p>}
        <fieldset className="mt-8 space-y-3">
          <legend className="mb-3 text-sm font-semibold text-neutral-900">Choose an edition or print size</legend>
          {variants.map(variant =>
            <label key={variant.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${selected === variant.id ? "border-neutral-900" : "border-neutral-200"}`}>
              <input type="radio" name="variant" value={variant.id} checked={selected === variant.id}
                onChange={() => {setSelected(variant.id); setQuantity(1); setMessage(null);}}/>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{isPublicPrintVariant(variant) ? publicPrintVariantLabel(variant) : variant.name}</span>
                <span className="block text-xs text-neutral-500">{originalsOnly ? "Original" : variant.fulfillment === "DIGITAL" ? "Digital download" : isPublicPrintVariant(variant) ? "Art print" : "Physical product"}</span>
              </span>
              <span className="text-right text-sm tabular-nums">
                {variant.compareAtMinor !== null && variant.compareAtMinor > variant.priceMinor &&
                  <span className="block text-xs text-neutral-500 line-through">{formatCatalogPrice(variant.compareAtMinor,variant.currency)}</span>}
                {formatCatalogPrice(variant.priceMinor, variant.currency)}
                {!variant.available && <span className="block text-xs text-red-600">Unavailable</span>}
              </span>
            </label>
          )}
        </fieldset>
        {active && <p className="mt-4 text-sm text-neutral-700" aria-live="polite">
          Selected: {isPublicPrintVariant(active) ? publicPrintVariantLabel(active) : active.name}
          {" · "}{formatCatalogPrice(active.priceMinor, active.currency)}
        </p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="text-sm text-neutral-700">Quantity
            <select className="ml-2 rounded-md border border-neutral-200 p-2" value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}>
              {Array.from({length: originalsOnly ? 1 : 20}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button type="button" disabled={!active?.available || busy} onClick={() => active && void addVariant(active)}
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Adding…" : active?.available ? "Add to cart" : "Unavailable"}
          </button>
          <Link className="rounded-full border border-neutral-300 px-6 py-3 text-sm text-neutral-800" href="/cart">View cart</Link>
        </div>
        {message && <p role="status" className="mt-4 text-sm text-neutral-700">{message}</p>}
        <p className="mt-5 text-xs text-neutral-500">Payment and fulfillment are confirmed only by the secure checkout provider; cart prices are preliminary.</p>
      </section>
    </div>}
  </main>;
}
