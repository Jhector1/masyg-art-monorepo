// File: src/app/page.tsx
import Link from "next/link";
// import { serverFetchJSON } from "./lib/server/api";
import ProductCardOriginal from "@/components/store/ProductCardOriginal";
import type { Product } from "./lib/products";
import { serverFetchJSON } from "../lib/server/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const products = await serverFetchJSON<Product[]>("/api/products?type=ORIGINAL").catch(() => []);
  const featured = products.slice(0, 8);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      {/* HERO */}
      <section className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 pt-16 pb-14 md:pt-24 md:pb-18">
        <div className="max-w-5xl">
          <h1 className="text-3xl md:text-5xl tracking-tight font-medium">Jean&nbsp;Yves&nbsp;Hector</h1>
          <p className="mt-3 md:mt-4 text-sm md:text-base text-neutral-500 max-w-xl">
            Originals only — paintings & drawings. Minimal. Quiet. Considered.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/store" className="inline-flex items-center rounded-full border border-neutral-900 px-4 py-2 text-sm hover:-translate-y-[1px] transition">
              View store
            </Link>
            <Link href="/about" className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:border-neutral-400 transition">
              About
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED ORIGINALS */}
      <section className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 pb-16 md:pb-24">
        <div className="mb-6 md:mb-8 flex items-end justify-between">
          <h2 className="text-lg md:text-xl tracking-tight">Featured originals</h2>
          <Link href="/store" className="text-xs md:text-sm text-neutral-500 hover:text-neutral-700 transition">
            See all →
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">No works available right now.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
            {featured.map((p) => (
              <ProductCardOriginal key={p.id} product={p} href={`/art/${p.id}`} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
