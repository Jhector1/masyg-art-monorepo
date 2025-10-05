"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Search, SlidersHorizontal, X, Receipt } from "lucide-react";

// ————————————————————————————————————————————————
// Types (lean)
// ————————————————————————————————————————————————
export type PurchasedDesignDTO = {
  id: string;
  orderId: string;
  productId: string;
  productTitle?: string | null;
  previewUrl?: string | null;
  createdAt: string; // ISO
};

// Server is expected to return { items: PurchasedDesignDTO[], nextCursor?: string }
async function fetchPurchasedDesigns(cursor?: string) {
  const url = cursor ? `/api/designs/purchases?cursor=${encodeURIComponent(cursor)}` : "/api/designs/purchases";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load purchases");
  return (await res.json()) as { items: PurchasedDesignDTO[]; nextCursor?: string };
}

// ————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————
function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

// ————————————————————————————————————————————————
// Main component — simple gallery using previewUrl only
// ————————————————————————————————————————————————
export default function PurchasedDesignLibrary() {
  const [items, setItems] = useState<PurchasedDesignDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [viewer, setViewer] = useState<null | PurchasedDesignDTO>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPurchasedDesigns()
      .then(({ items, nextCursor }) => {
        if (!cancelled) {
          setItems(items);
          setNextCursor(nextCursor);
        }
      })
      .catch((e) => !cancelled && setError(e?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) {
      list = list.filter((it) => [it.productTitle, it.productId, it.id].some((v) => (v || "").toLowerCase().includes(q)));
    }
    list = [...list].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === "newest" ? db - da : da - db;
    });
    return list;
  }, [items, query, sort]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const { items: more, nextCursor: n } = await fetchPurchasedDesigns(nextCursor);
      setItems((prev) => [...prev, ...more]);
      setNextCursor(n);
    } catch (e: any) {
      setError(e?.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Purchased Designs</h1>
          <p className="text-sm text-black/60">A clean gallery of everything you've bought.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or ID…"
              className="w-64 rounded-xl border border-black/10 bg-white pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="rounded-xl border border-black/10 bg-white pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <SlidersHorizontal className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 text-amber-900">{error}</div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <li key={item.id}>
                <Card item={item} onView={() => setViewer(item)} />
              </li>
            ))}
          </ul>

          {nextCursor && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-emerald-50 disabled:opacity-60"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {/* Viewer Modal */}
      <AnimatePresence>
        {viewer && <ViewerModal item={viewer} onClose={() => setViewer(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ————————————————————————————————————————————————
// Card (no downloads, just preview + meta)
// ————————————————————————————————————————————————
function Card({ item, onView }: { item: PurchasedDesignDTO; onView: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onView}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group relative w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-black/10 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="aspect-square overflow-hidden bg-[conic-gradient(at_20%_20%,#fafafa,#f4f4f5)]">
        {item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt={item.productTitle || item.productId}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-black/40">No preview</div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.productTitle || `Product ${item.productId.slice(0, 6)}…`}</p>
            <p className="text-xs text-black/50">Purchased {formatDate(item.createdAt)}</p>
          </div>
          <ExternalLink className="h-4 w-4 text-black/40" />
        </div>
      </div>
    </motion.button>
  );
}

// ————————————————————————————————————————————————
// Viewer Modal (no download buttons)
// ————————————————————————————————————————————————
function ViewerModal({ item, onClose }: { item: PurchasedDesignDTO; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const first = dialogRef.current?.querySelector("button, a, input, select, textarea") as HTMLElement | null;
    first?.focus();
  }, []);

  return (
    <motion.div className="fixed inset-0 z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.button aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="relative mx-auto w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/10"
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 360, damping: 28, mass: 0.9 }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{item.productTitle || `Product ${item.productId.slice(0, 6)}…`}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-black/60 hover:bg-zinc-100 hover:text-black/80" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_300px]">
          <div className="overflow-hidden rounded-xl ring-1 ring-black/10 bg-[conic-gradient(at_20%_20%,#fafafa,#f4f4f5)]">
            {item.previewUrl ? (
              <img src={item.previewUrl} alt={item.id} className="w-full object-contain" />
            ) : (
              <div className="grid h-[420px] place-items-center text-sm text-black/40">No preview</div>
            )}
          </div>

          <div className="rounded-xl border border-black/10 p-3">
            <dl className="space-y-2 text-sm">
              <div className="grid grid-cols-[110px_1fr] items-start gap-2">
                <dt className="text-black/60">Design ID</dt>
                <dd className="font-medium break-all">{item.id}</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2">
                <dt className="text-black/60">Product</dt>
                <dd className="font-medium break-all">{item.productTitle || item.productId}</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2">
                <dt className="text-black/60">Order</dt>
                <dd>
                  <a href={`/orders/${item.orderId}`} className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                    <Receipt className="h-4 w-4" /> View receipt
                  </a>
                </dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2">
                <dt className="text-black/60">Purchased</dt>
                <dd className="font-medium">{formatDate(item.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ————————————————————————————————————————————————
// Skeleton & Empty state
// ————————————————————————————————————————————————
function GridSkeleton() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl ring-1 ring-black/10">
          <div className="h-64 animate-pulse bg-zinc-100" />
          <div className="p-3">
            <div className="mb-2 h-4 w-40 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-2xl bg-white p-10 ring-1 ring-black/10">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
          <ExternalLink className="h-7 w-7 text-emerald-700" />
        </div>
        <h3 className="text-lg font-semibold">No purchases yet</h3>
        <p className="mt-1 text-sm text-black/60">When you buy a customized design, it will appear here with its preview image.</p>
        <a href="/shop" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Browse designs
        </a>
      </div>
    </div>
  );
}
