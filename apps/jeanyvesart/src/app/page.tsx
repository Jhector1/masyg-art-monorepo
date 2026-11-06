// File: src/app/page.tsx
import Link from "next/link";
import OriginalCatalogGrid from "@/components/store/OriginalCatalogGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      {/* HERO */}
      <section className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 pt-16 pb-14 md:pt-24 md:pb-18">
        <div className="max-w-5xl">
          <h1 className="text-3xl md:text-5xl tracking-tight font-medium">
            Jean&nbsp;Yves
          </h1>
          <p className="mt-3 md:mt-4 text-sm md:text-base text-neutral-500 max-w-xl">
            Original paintings and drawings. By Jean Yves.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/store"
              className="inline-flex items-center rounded-full border border-neutral-900 px-4 py-2 text-sm hover:-translate-y-[1px] transition"
            >
              View store
            </Link>
            <Link
              href="/cart"
              className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:border-neutral-400 transition"
            >
              Cart
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED ORIGINALS */}
      <section className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 pb-16 md:pb-24">
        <div className="mb-6 md:mb-8 flex items-end justify-between">
          <h2 className="text-lg md:text-xl tracking-tight">
            Featured originals
          </h2>
          <Link
            href="/store"
            className="text-xs md:text-sm text-neutral-500 hover:text-neutral-700 transition"
          >
            See all →
          </Link>
        </div>

        <OriginalCatalogGrid limit={8} />
      </section>
    </main>
  );
}
