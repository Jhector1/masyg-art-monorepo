"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

import SEO from "@acme/ui/components/SEO";
import OriginalPublishedGallery from "@acme/ui/components/storefront/OriginalPublishedGallery";
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
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

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

      <OriginalPublishedGallery kind={kindFilter} />
    </>
  );
}
