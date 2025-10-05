// File: src/app/store/page.tsx
import ProductGridOriginal from "@/components/store/ProductGrid";
import { serverFetchJSON } from "@/lib/server/api";
import type { Product } from "@/lib/products";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function StorePage() {
  const products = await serverFetchJSON<Product[]>("/api/products?type=ORIGINAL").catch(() => []);

  // If you want only AVAILABLE originals, keep this filter:
  const available = products.filter((p) =>
    (p.variants ?? []).some((v) => v.type === "ORIGINAL" && (v.status ?? "ACTIVE") === "ACTIVE" && (v.inventory ?? 1) > 0)
  );

  const favorites = await serverFetchJSON<{ productIds: string[] }>("/api/favorites").catch(() => ({ productIds: [] }));

  return (
    <main className="min-h-screen bg-white">
      <section className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 py-10 md:py-14">
        <div className="mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl tracking-tight font-medium text-neutral-900">Originals</h1>
          <p className="mt-2 text-sm text-neutral-500">Paintings & drawings. One of one.</p>
        </div>

        <ProductGridOriginal
          products={available.length ? available : products}
          initialFavoriteIds={favorites.productIds ?? []}
        />
      </section>
    </main>
  );
}
