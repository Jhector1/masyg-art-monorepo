"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

import SEO from "@acme/ui/components/SEO";
import Gallery from "@acme/ui/components/store/Gallery";
import { ProductListItem } from "@acme/core/types";
import { fetchProducts } from "@acme/core/utils/fetchProducts";
import { KINDS } from "@acme/core/data/categories";

type KindFilter = "ALL" | (typeof KINDS)[number];

const KINDS_WITH_ALL: KindFilter[] = Array.from(
  new Set(["ALL", ...KINDS.map(k => k.toUpperCase())])
) as KindFilter[];

function normalizeKindParam(value: string | null): KindFilter {
  if (!value) return "ALL";
  const upper = value.toUpperCase();
  return (KINDS_WITH_ALL as readonly string[]).includes(upper) ? (upper as KindFilter) : "ALL";
}

export default function StoreClient() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchProducts().then(setProducts).catch(console.error);
  }, []);

  const kindParam = searchParams.get("kind");
  useEffect(() => {
    setKindFilter(normalizeKindParam(kindParam));
  }, [kindParam]);

  const handleFilterChange = (next: KindFilter) => {
    setKindFilter(next);

    const params = new URLSearchParams(searchParams.toString());
    if (next === "ALL") params.delete("kind");
    else params.set("kind", next);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const filtered = useMemo(() => {
    if (kindFilter === "ALL") return products;
    return products.filter((p) => p.kind === kindFilter);
  }, [products, kindFilter]);
  return (
    <>
      <SEO title="Haitian Digital Art Gallery" description="Buy and explore uniquely crafted Haitian vector artworks." />

      <div className="flex gap-3 justify-center my-6 flex-wrap">
        {KINDS_WITH_ALL.map((k) => (
          <button
            key={k}
            onClick={() => handleFilterChange(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              kindFilter === k ? "bg-black text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <Gallery products={filtered} />
    </>
  );
}
