// File: src/components/ProductGrid.tsx
"use client";

import * as React from "react";
import ProductCardOriginal from "@/components/store/ProductCardOriginal";
import type { Product } from "@/lib/products";

export default function ProductGridOriginal({
  products,
  initialFavoriteIds = [],
}: {
  products: Product[];
  initialFavoriteIds?: string[];
}) {
  const [favoriteIds, setFavoriteIds] = React.useState(
    new Set<string>(initialFavoriteIds)
  );
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggleFavorite(productId: string) {
    // optimistic
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
    setBusy(productId);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("toggle failed");
    } catch {
      // rollback
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.has(productId) ? next.delete(productId) : next.add(productId);
        return next;
      });
    } finally {
      setBusy(null);
    }
  }

  if (!products?.length) {
    return (
      <div className="py-24 text-center text-neutral-500">
        No originals available right now.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
      {products.map((p) => (
        <ProductCardOriginal
          key={p.id}
          product={p}
          href={`/store/${p.id}`}
          isFavorite={favoriteIds.has(p.id)}
          busy={busy === p.id}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </div>
  );
}
