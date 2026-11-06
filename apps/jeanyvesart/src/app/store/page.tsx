// File: src/app/store/page.tsx
import OriginalCatalogGrid from "@/components/store/OriginalCatalogGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default function StorePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 py-10 md:py-14">
        <div className="mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl tracking-tight font-medium text-neutral-900">Originals</h1>
          <p className="mt-2 text-sm text-neutral-500">Paintings & drawings. One of one.</p>
        </div>

        <OriginalCatalogGrid />
      </section>
    </main>
  );
}
