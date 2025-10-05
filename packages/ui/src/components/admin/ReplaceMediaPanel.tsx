
// File: src/components/admin/ReplaceMediaPanel.tsx
"use client";

import * as React from "react";
import {Field} from "./shared/Field"

type RmpProps = {
  productId: string;
  defaultCategoryName: string;
  onReplaced?: () => void;
};

export default function ReplaceMediaPanel({ productId, defaultCategoryName, onReplaced }: RmpProps) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Record<string, File[]>>({});

  function rememberFiles(name: string, files: FileList | null) {
    setSelected((s) => ({ ...s, [name]: files ? Array.from(files) : [] }));
  }

  async function send() {
    setBusy(true);
    setMsg(null);
    setErr(null);

    const form = document.getElementById("replace-form") as HTMLFormElement | null;
    if (!form) return;

    const fd = new FormData(form);

    // Convert sizes textarea -> multiple sizes fields
    const sizesText = (fd.get("sizesText") as string | null) ?? "";
    fd.delete("sizesText");
    sizesText
      .split(/\r?\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => fd.append("sizes", s));

    const res = await fetch(`/api/admin/products/${productId}/assets/replace`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok || data?.ok === false) {
      setErr(data?.error || `Replace failed (${res.status})`);
      return;
    }
    setMsg("Media replaced.");
    form.reset();
    setSelected({});
    onReplaced?.();
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Replace media</h2>
        {msg && <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{msg}</span>}
        {err && <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">{err}</span>}
      </div>

      <form id="replace-form" className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Optional: update Title">
            <input name="title" className={inputBase} placeholder="Leave empty to keep" />
          </Field>
          <Field label="Optional: update Category (name)" >
            <input name="category" className={inputBase} placeholder={defaultCategoryName} />
          </Field>
        </div>

        <Field label="Optional: update Description">
          <textarea name="description" rows={3} className={inputBase} />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Optional: update Price">
            <input name="price" type="number" step="0.01" min="0" className={inputBase} />
          </Field>
          <Field label="Optional: Sizes (one per line or CSV)">
            <textarea name="sizesText" rows={3} className={inputBase} />
          </Field>
        </div>

        <fieldset className="grid gap-4 rounded-xl border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-800">Files (any subset)</legend>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className={labelBase}>Main (watermarked preview)</label>
              <input name="main" type="file" accept="image/*" className="block w-full text-sm" onChange={(e) => rememberFiles("main", e.currentTarget.files)} />
              <FileListSmall files={selected["main"]} />
            </div>
            <div className="grid gap-2">
              <label className={labelBase}>SVG (optional)</label>
              <input name="svg" type="file" accept=".svg,image/svg+xml" className="block w-full text-sm" onChange={(e) => rememberFiles("svg", e.currentTarget.files)} />
              <FileListSmall files={selected["svg"]} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className={labelBase}>Thumbnails (multiple)</label>
              <input name="thumbnails" type="file" accept="image/*" multiple className="block w-full text-sm" onChange={(e) => rememberFiles("thumbnails", e.currentTarget.files)} />
              <FileListSmall files={selected["thumbnails"]} />
            </div>
            <div className="grid gap-2">
              <label className={labelBase}>Other formats (PNG/JPG/PDF/etc.)</label>
              <input name="formats" type="file" multiple className="block w-full text-sm" onChange={(e) => rememberFiles("formats", e.currentTarget.files)} />
              <FileListSmall files={selected["formats"]} />
            </div>
          </div>
          <p className="text-sm text-neutral-600">Anything you provide here will replace the existing set.</p>
        </fieldset>

        <div>
          <button type="button" onClick={send} disabled={busy} className="rounded-lg border px-4 py-2 text-sm hover:bg-neutral-50">
            {busy ? "Replacing…" : "Replace media"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FileListSmall({ files }: { files?: File[] }) {
  if (!files || !files.length) return null;
  return (
    <ul className="max-h-28 w-full overflow-y-auto rounded-md border bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 py-0.5">
          <span className="truncate">{f.name}</span>
          <span className="shrink-0 tabular-nums text-neutral-500">{prettyBytes(f.size)}</span>
        </li>
      ))}
    </ul>
  );
}

// Reuse helpers from the other file (duplicate minimal ones here to keep files independent)
const inputBase =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5 disabled:opacity-50 disabled:pointer-events-none";
const labelBase = "text-sm font-medium text-neutral-800";
function prettyBytes(n: number) {
  const u = ["B", "KB", "MB", "GB"]; let i = 0; let v = n; while (v >= 1024 && i < u.length - 1) { v = v / 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}



