// src/app/admin/private/editor/page.tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Optional: keep this so the route never tries to prerender
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6 text-neutral-500">Loading…</div>}>
      <EditorClient />
    </Suspense>
  );
}

type ProductCard = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  thumbnails?: string[] | null;
  svgPreview?: string | null;
  category?: { name: string } | null;
};

function EditorClient() {
  
  const router = useRouter();
  const sp = useSearchParams();            // ✅ ok inside Suspense
  const q = sp?.get("q") ?? "";

  const [products, setProducts] = useState<ProductCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    fetch(`/api/admin/products?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.text())))
      .then((data) => setProducts(data))
      .catch((e) => setErr(typeof e === "string" ? e : e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [q]);

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = String(fd.get("q") || "").trim();
    router.replace(next ? `?q=${encodeURIComponent(next)}` : "?");
  };

  const onDelete = async (id: string) => {
    const sure = prompt('Type DELETE to remove (keeps order history). For hard purge use "DELETE:HARD".');
    if (sure !== "DELETE" && sure !== "DELETE:HARD") return;
    const hard = sure === "DELETE:HARD" ? "?hard=1" : "";
    const r = await fetch(`/api/admin/products/${id}${hard}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.ok === false) return alert(d?.error || `Delete failed (${r.status})`);
    setProducts((prev) => prev?.filter((p) => p.id !== id) ?? null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/admin/private/uploader" className="inline-flex items-center px-3 py-2 rounded bg-black text-white">
          + New product
        </Link>
      </div>

      <form className="flex gap-2" onSubmit={onSearch}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by title, description, or category…"
          className="w-full border rounded px-3 py-2"
        />
        <button className="px-3 py-2 rounded border">Search</button>
      </form>

      {loading && <div className="text-neutral-500">Loading…</div>}
      {err && <div className="text-red-600 text-sm">{err}</div>}

      {!loading && !err && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(products ?? []).map((p) => (
              <article key={p.id} className="border rounded-lg p-4 space-y-3">
                <div className="aspect-video bg-neutral-100 overflow-hidden rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbnails?.[0] ?? p.svgPreview ?? ""} alt={p.title} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm text-neutral-500">{p.category?.name ?? "Uncategorized"}</div>
                  <h2 className="font-medium">{p.title}</h2>
                  <div className="text-sm text-neutral-600 line-clamp-2">{p.description}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>${p.price.toFixed(2)}</span>
                  <div className="flex gap-2">
                    <Link href={`/admin/products/${p.id}/edit`} className="px-2 py-1 rounded border">
                      Edit
                    </Link>
                    <button type="button" onClick={() => onDelete(p.id)} className="px-2 py-1 rounded bg-red-600 text-white">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {(products?.length ?? 0) === 0 && (
            <div className="text-center text-neutral-500 py-20">No products yet.</div>
          )}
        </>
      )}
    </div>
  );
}
