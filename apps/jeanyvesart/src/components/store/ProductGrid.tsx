// src/components/ProductGrid.tsx
"use client";
import * as React from "react";
import ProductCardOriginal from "@/components/store/ProductCardOriginal";
import type { Product } from "@/lib/products";

export default function ProductGridOriginal({ products }: { products: Product[] }) {
  const [busy, setBusy] = React.useState<string | null>(null);

  if (!products?.length) {
    return <div className="py-24 text-center text-neutral-500">No originals available right now.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
      {products.map((p) => (
        <ProductCardOriginal
          key={p.id}
          product={p}
          href={`/store/${p.id}`}
          busy={busy === p.id}
          onBusyChange={setBusy}   // add this prop (below)
        />
      ))}
    </div>
  );
}
