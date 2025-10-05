"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function NewProductUploader() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    // Convert sizes textarea -> multiple "sizes" entries (your upload route expects getAll("sizes"))
    const sizesText = (fd.get("sizesText") as string | null) ?? "";
    fd.delete("sizesText");
    sizesText
      .split(/\r?\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => fd.append("sizes", s));

    // POST to your existing route
    const res = await fetch("/api/products/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data?.error || data?.details || `Upload failed (${res.status})`);
      return;
    }
    // Success: go to edit page
    router.push(`/admin/products/${data.id}/edit`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {err && <div className="rounded bg-red-50 text-red-700 px-3 py-2">{err}</div>}

      <div className="grid gap-1">
        <label className="font-medium">Category (name)</label>
        <input name="category" required className="border rounded px-3 py-2" placeholder="e.g., Abstract" />
      </div>

      <div className="grid gap-1">
        <label className="font-medium">Title</label>
        <input name="title" required className="border rounded px-3 py-2" />
      </div>

      <div className="grid gap-1">
        <label className="font-medium">Description</label>
        <textarea name="description" rows={4} className="border rounded px-3 py-2" />
      </div>

      <div className="grid gap-1">
        <label className="font-medium">Price (USD)</label>
        <input name="price" type="number" step="0.01" min="0" required className="border rounded px-3 py-2" />
      </div>

      <fieldset className="border rounded p-4 grid gap-3">
        <legend className="px-2 font-semibold">Files</legend>
        <div className="grid gap-1">
          <label className="font-medium">Main (watermarked preview)</label>
          <input name="main" type="file" accept="image/*" required />
        </div>
        <div className="grid gap-1">
          <label className="font-medium">Thumbnails (optional, multiple)</label>
          <input name="thumbnails" type="file" accept="image/*" multiple />
        </div>
        <div className="grid gap-1">
          <label className="font-medium">SVG (optional)</label>
          <input name="svg" type="file" accept=".svg,image/svg+xml" />
        </div>
        <div className="grid gap-1">
          <label className="font-medium">Other formats (PNG/JPG/PDF/etc.)</label>
          <input name="formats" type="file" multiple />
        </div>
      </fieldset>

      <div className="grid gap-1">
        <label className="font-medium">Sizes (one per line or CSV)</label>
        <textarea name="sizesText" rows={4} className="border rounded px-3 py-2" placeholder={`8" x 10"\n12" x 12"`} />
      </div>

      <div className="flex gap-3">
        <button disabled={busy} className="px-4 py-2 rounded bg-black text-white">
          {busy ? "Uploading…" : "Create product"}
        </button>
      </div>
    </form>
  );
}
