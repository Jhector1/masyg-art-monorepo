// File: src/components/admin/ProductEditorForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Product, Category } from "@prisma/client";
import ReplaceMediaPanel from "./ReplaceMediaPanel";
import {Field} from "./shared/Field"
import { formatSizeLive, normalizeSizeOnBlur, SIZE_PATTERN, SIZE_RE } from "@acme/core/utils/helpers";

// ---------- small UI helpers ----------
const cx = (...s: Array<string | false | null | undefined>) => s.filter(Boolean).join(" ");
const inputBase =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5 disabled:opacity-50 disabled:pointer-events-none";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] leading-5 text-neutral-700">
      {children}
    </span>
  );
}

function toDatetimeLocalValue(d: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(+dt)) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function splitList(v: string) {
  return v
    .split(/\r?\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toIsoOrNull(v: string) {
  return v ? new Date(v).toISOString() : null; // local → ISO preserving moment
}

function prettyMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function useAutoGrowTextarea(
  ref:
    | React.RefObject<HTMLTextAreaElement | null>
    | React.MutableRefObject<HTMLTextAreaElement | null>,
  dep: unknown
) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 120), 520)}px`;
  }, [dep, ref]);
}

// usage
// const descRef = React.useRef<HTMLTextAreaElement | null>(null);
// useAutoGrowTextarea(descRef, description);


// ---------- main component ----------
type Props = {
  product: Product & { category?: Category | null };
  categories: Category[];
};

export default function ProductEditorForm({ product, categories }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState(product.title);
  const [description, setDescription] = React.useState(product.description);
  const [price, setPrice] = React.useState(product.price.toString());
  const [categoryId, setCategoryId] = React.useState<string | null>(product.categoryId as any);
  const [publicId, setPublicId] = React.useState(product.publicId ?? "");
  const [svgFormat, setSvgFormat] = React.useState(product.svgFormat ?? "");
  const [svgPreview, setSvgPreview] = React.useState(product.svgPreview ?? "");
  const [salePercent, setSalePercent] = React.useState<number | undefined>(product.salePercent ?? undefined);
  const [salePrice, setSalePrice] = React.useState<number | undefined>(product.salePrice ?? undefined);
  const [saleStartsAt, setSaleStartsAt] = React.useState<string>(toDatetimeLocalValue(product.saleStartsAt ?? null));
  const [saleEndsAt, setSaleEndsAt] = React.useState<string>(toDatetimeLocalValue(product.saleEndsAt ?? null));
  const [sizesText, setSizesText] = React.useState((product.sizes ?? []).join("\n"));
  const [formatsText, setFormatsText] = React.useState((product.formats ?? []).join("\n"));
  const [thumbsText, setThumbsText] = React.useState((product.thumbnails ?? []).join("\n"));

  // auto-grow large textareas
  const descRef = React.useRef<HTMLTextAreaElement>(null);
  const sizesRef = React.useRef<HTMLTextAreaElement>(null);
  const thumbsRef = React.useRef<HTMLTextAreaElement>(null);
  const formatsRef = React.useRef<HTMLTextAreaElement>(null);
  useAutoGrowTextarea(descRef, description);
  useAutoGrowTextarea(sizesRef, sizesText);
  useAutoGrowTextarea(thumbsRef, thumbsText);
  useAutoGrowTextarea(formatsRef, formatsText);

  // sale mode controls (clean UX: one source of truth)
  type SaleMode = "none" | "percent" | "price";
  const saleMode: SaleMode = salePrice != null && salePrice !== undefined && salePrice !== ("" as any)
    ? "price"
    : salePercent != null && salePercent !== undefined
    ? "percent"
    : "none";

  function setSaleMode(m: SaleMode) {
    if (m === "none") {
      setSalePercent(undefined);
      setSalePrice(undefined);
    } else if (m === "percent") {
      setSalePrice(undefined);
      if (salePercent == null) setSalePercent(10);
    } else if (m === "price") {
      setSalePercent(undefined);
      if (salePrice == null) setSalePrice(Math.max(0, Number(price) * 0.8 || 0));
    }
  }

  const basePrice = Number(price) || 0;
  const effectivePrice = saleMode === "price"
    ? Math.max(0, Number(salePrice) || 0)
    : saleMode === "percent"
    ? Math.max(0, +(basePrice * (1 - (Number(salePercent) || 0) / 100)).toFixed(2))
    : basePrice;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);

    const body = {
      title,
      description,
      price: Number(price),
      categoryId,
      publicId: publicId || product.publicId,
   sizes: Array.from(
    new Set(splitList(sizesText).map((s) => normalizeSizeOnBlur(s)))
  ),
      thumbnails: splitList(thumbsText),
      formats: splitList(formatsText),
      svgFormat: svgFormat || null,
      svgPreview: svgPreview || null,
      salePercent: saleMode === "percent" ? salePercent ?? null : null,
      salePrice: saleMode === "price" ? salePrice ?? null : null,
      saleStartsAt: toIsoOrNull(saleStartsAt),
      saleEndsAt: toIsoOrNull(saleEndsAt),
    } as const;

    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data?.error || `Save failed (${res.status})`);
      return;
    }
    setOk("Saved");
    router.refresh();
    setTimeout(() => setOk(null), 2000);
  }

  async function onDelete(hard: boolean) {
    const msg = hard
      ? "Type DELETE:HARD to permanently purge this product and related lines."
      : "Type DELETE to remove this product (order history kept).";
    const sure = prompt(msg);
    if ((!hard && sure !== "DELETE") || (hard && sure !== "DELETE:HARD")) return;

    const res = await fetch(`/api/admin/products/${product.id}${hard ? "?hard=1" : ""}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      alert(data?.error || `Delete failed (${res.status})`);
      return;
    }
    router.push("/admin/products");
  }

//   const listPreviewSizes = splitList(sizesText);
//   const listPreviewThumbs = splitList(thumbsText);
//   const listPreviewFormats = splitList(formatsText);

  return (
    <>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-40 -mx-4 mb-4 border-b bg-white/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="truncate text-sm text-neutral-700">
            Editing <span className="font-semibold text-neutral-900">{product.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              type="button"
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-black/90 focus:ring-4 focus:ring-black/20"
              onClick={(e) => {
                e.preventDefault();
                // submit the form programmatically to keep sticky bar buttons
                const form = document.getElementById("product-edit-form") as HTMLFormElement | null;
                form?.requestSubmit();
              }}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="mx-auto max-w-5xl">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[2px]">
              <path d="M12 9v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        )}
        {ok && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[2px]">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm">{ok}</span>
          </div>
        )}
      </div>

      {/* MAIN EDIT FORM */}
      <form id="product-edit-form" onSubmit={save} className="mx-auto grid max-w-5xl gap-6">
        {/* Details */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-4 text-base font-semibold">Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" htmlFor="title">
              <input id="title" className={inputBase} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Price">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={cx(inputBase, "pl-7")}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Category">
              <select className={inputBase} value={categoryId ?? undefined} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Public ID (Cloudinary)" help="Optional — usually set by uploads.">
              <input className={inputBase} value={publicId} onChange={(e) => setPublicId(e.target.value)} />
            </Field>
          </div>

          <Field label="Description">
            <textarea ref={descRef} rows={4} className={inputBase} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </section>

        {/* Media URLs */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-4 text-base font-semibold">Media URLs</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="SVG Format URL">
              <input className={inputBase} value={svgFormat} onChange={(e) => setSvgFormat(e.target.value)} />
            </Field>
            <Field label="SVG Preview URL">
              <input className={inputBase} value={svgPreview} onChange={(e) => setSvgPreview(e.target.value)} />
            </Field>
          </div>
        </section>

 {/* Lists */}
<section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
  <h2 className="mb-4 text-base font-semibold">Lists</h2>
  <div className="grid gap-4 md:grid-cols-3">
   <SizeEditor
      label="Sizes"
      items={splitList(sizesText)}
      onChange={(next) => setSizesText(next.join("\n"))}
    />

    <ListEditor
      label="Thumbnails (URLs)"
      items={splitList(thumbsText)}
      onChange={(next) => setThumbsText(next.join("\n"))}
      placeholder="https://…"
      type="url"
    />

    <ListEditor
      label="Formats (URLs)"
      items={splitList(formatsText)}
      onChange={(next) => setFormatsText(next.join("\n"))}
      placeholder="https://…"
      type="url"
    />
  </div>
</section>


        {/* Sale */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Sale</h2>
            <div className="text-sm text-neutral-700">
              Effective: <span className="font-semibold">{prettyMoney(effectivePrice)}</span>
              {saleMode !== "none" && basePrice > 0 && effectivePrice < basePrice ? (
                <span className="ml-2 text-neutral-500 line-through">{prettyMoney(basePrice)}</span>
              ) : null}
            </div>
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sale-mode"
                className="h-4 w-4"
                checked={saleMode === "none"}
                onChange={() => setSaleMode("none")}
              />
              No sale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sale-mode"
                className="h-4 w-4"
                checked={saleMode === "percent"}
                onChange={() => setSaleMode("percent")}
              />
              By percent
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sale-mode"
                className="h-4 w-4"
                checked={saleMode === "price"}
                onChange={() => setSaleMode("price")}
              />
              By fixed price
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sale Percent (1–100)">
              <input
                type="number"
                min={1}
                max={100}
                className={inputBase}
                value={saleMode === "percent" ? (salePercent ?? "") : ""}
                onChange={(e) => setSalePercent(e.target.value ? Number(e.target.value) : undefined)}
                disabled={saleMode !== "percent"}
              />
            </Field>
            <Field label="Sale Price ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputBase}
                value={saleMode === "price" ? (salePrice ?? "") : ""}
                onChange={(e) => setSalePrice(e.target.value ? Number(e.target.value) : undefined)}
                disabled={saleMode !== "price"}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Sale Starts">
              <div className="flex items-center gap-2">
                <input type="datetime-local" className={cx(inputBase, "flex-1")} value={saleStartsAt} onChange={(e) => setSaleStartsAt(e.target.value)} />
                <button type="button" className="rounded-lg border px-2.5 py-1 text-sm hover:bg-neutral-50" onClick={() => setSaleStartsAt("")}>Clear</button>
                <button type="button" className="rounded-lg border px-2.5 py-1 text-sm hover:bg-neutral-50" onClick={() => setSaleStartsAt(toDatetimeLocalValue(new Date()))}>Now</button>
              </div>
            </Field>
            <Field label="Sale Ends">
              <div className="flex items-center gap-2">
                <input type="datetime-local" className={cx(inputBase, "flex-1")} value={saleEndsAt} onChange={(e) => setSaleEndsAt(e.target.value)} />
                <button type="button" className="rounded-lg border px-2.5 py-1 text-sm hover:bg-neutral-50" onClick={() => setSaleEndsAt("")}>Clear</button>
              </div>
            </Field>
          </div>
        </section>

        {/* Bottom actions + Danger zone */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 focus:ring-4 focus:ring-black/20">
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm hover:bg-neutral-50">
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* OUTSIDE THE MAIN FORM — no nesting */}
      <div className="mx-auto mt-8 max-w-5xl">
        <ReplaceMediaPanel productId={product.id} defaultCategoryName={product.category?.name ?? "Uncategorized"} onReplaced={() => router.refresh()} />
      </div>

      <section className="mx-auto mt-8 max-w-5xl rounded-2xl border border-red-200 bg-red-50 p-4">
        <h2 className="text-base font-semibold text-red-800">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm text-red-700">Deleting is permanent. Consider unlisting instead if you only want to hide it.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-600/90" onClick={() => onDelete(false)}>
            Delete (keep order history)
          </button>
          <button type="button" className="rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-900/90" onClick={() => onDelete(true)}>
            Hard purge (erase lines)
          </button>
        </div>
      </section>

      {/* Busy overlay */}
      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border bg-white px-4 py-2 shadow-sm">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-sm">Saving…</span>
          </div>
        </div>
      )}
    </>
  );
}

// function ListChips({ items }: { items: string[] }) {
//   if (!items.length) return <span className="text-xs text-neutral-400">—</span>;
//   return (
//     <span className="inline-flex flex-wrap gap-1.5 align-middle">
//       {items.map((it, i) => (
//         <Chip key={`${it}-${i}`}>{it}</Chip>
//       ))}
//     </span>
//   );
// }

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  type = "text", // "text" | "url"
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  type?: "text" | "url";
}) {
  const [draft, setDraft] = React.useState<string[]>(items);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkText, setBulkText] = React.useState(items.join("\n"));
  const addRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraft(items);
    setBulkText(items.join("\n"));
  }, [items]);

  const splitList = (v: string) =>
    v
      .split(/\r?\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);

  function commit(next: string[]) {
    // trim + dedupe (stable)
    const seen = new Set<string>();
    const cleaned = next
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && (!seen.has(s) && seen.add(s)));
    setDraft(cleaned);
    onChange(cleaned);
  }

  function addOne(v: string) {
    const parts = splitList(v);
    if (!parts.length) return;
    commit([...draft, ...parts]);
    if (addRef.current) addRef.current.value = "";
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    const next = draft.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  function removeAt(i: number) {
    const next = draft.slice();
    next.splice(i, 1);
    commit(next);
  }

  function replaceAt(i: number, v: string) {
    const next = draft.slice();
    next[i] = v;
    commit(next);
  }

  function applyBulk() {
    commit(splitList(bulkText));
    setBulkOpen(false);
  }

  const urlInvalid = (s: string) => type === "url" && !/^https?:\/\//i.test(s);

  return (
    <div className="rounded-xl border border-neutral-200 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-900">{label}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            className="rounded-lg border px-2.5 py-1 text-xs hover:bg-neutral-50"
          >
            {bulkOpen ? "Close bulk" : "Bulk edit"}
          </button>
          <button
            type="button"
            onClick={() => commit(draft)}
            className="rounded-lg border px-2.5 py-1 text-xs hover:bg-neutral-50"
            title="Trim & dedupe"
          >
            Clean
          </button>
        </div>
      </div>

      {bulkOpen ? (
        <div className="grid gap-2">
          <textarea
            rows={6}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"One per line or CSV…"}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyBulk}
              className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {draft.length === 0 ? (
            <p className="text-xs text-neutral-500">No items yet.</p>
          ) : (
            <ul className="space-y-2">
              {draft.map((it, i) => (
                <li key={`${it}-${i}`} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs text-neutral-500">{i + 1}.</span>

                  {type === "url" ? (
                    <img
                      src={it}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md border object-cover"
                      onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                    />
                  ) : null}

                  <input
                    className={
                      "w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5 " +
                      (urlInvalid(it) ? "border-red-300" : "border-neutral-300")
                    }
                    type={type === "url" ? "url" : "text"}
                    value={it}
                    onChange={(e) => replaceAt(i, e.target.value)}
                  />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
                      onClick={() => move(i, 1)}
                      disabled={i === draft.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      onClick={() => removeAt(i)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center gap-2">
            <input
              ref={addRef}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5"
              placeholder={placeholder || (type === "url" ? "https://…" : "Add item…")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOne((e.target as HTMLInputElement).value);
                }
              }}
            />
            <button
              type="button"
              className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/90"
              onClick={() => addOne(addRef.current?.value || "")}
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}



function SizeEditor({
  label = "Sizes",
  items,
  onChange,
}: {
  label?: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [rows, setRows] = React.useState<string[]>(items);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkText, setBulkText] = React.useState(items.join("\n"));
  const addRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setRows(items);
    setBulkText(items.join("\n"));
  }, [items]);

  const splitList = (v: string) =>
    v.split(/\r?\n|,/g).map((s) => s.trim()).filter(Boolean);

function commit(next: string[]) {
  // normalize + trim + dedupe (stable)
  const cleaned = next
    .map((s) => normalizeSizeOnBlur(s).trim())
    .filter((s) => s.length && SIZE_RE.test(s));
  const seen = new Set<string>();
  const deduped = cleaned.filter((s) => !seen.has(s) && (seen.add(s), true));
  setRows(deduped);
  onChange(deduped);
}

// NEW: raw commit that does not normalize/filter (for reorder)
function commitRaw(next: string[]) {
  // keep as-is (except trivial trim), preserve invalid-in-progress entries
  const kept = next.map((s) => s.trim());
  setRows(kept);
  onChange(kept);
}


  function addOne(v: string) {
    const parts = splitList(v).map(normalizeSizeOnBlur);
    if (!parts.length) return;
    commit([...rows, ...parts]);
    if (addRef.current) addRef.current.value = "";
  }

function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= rows.length) return;
  const next = rows.slice();
  [next[i], next[j]] = [next[j], next[i]];
  // IMPORTANT: Reorder without cleaning/validating
  commitRaw(next);
}

 function removeAt(i: number) {
  const next = rows.slice();
  next.splice(i, 1);
  // Removing is a “final” action → okay to clean
  commit(next);
}

function replaceAt(i: number, v: string) {
  const live = formatSizeLive(v);
  const next = rows.slice();
  next[i] = live;
  setRows(next); // keep typing free-form until blur
}

function blurAt(i: number) {
  const next = rows.slice();
  next[i] = normalizeSizeOnBlur(next[i]);
  commit(next); // only clean on explicit blur, not on reorder clicks
}

  function applyBulk() {
    commit(splitList(bulkText));
    setBulkOpen(false);
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-900">{label}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            className="rounded-lg border px-2.5 py-1 text-xs hover:bg-neutral-50"
          >
            {bulkOpen ? "Close bulk" : "Bulk edit"}
          </button>
          <button
            type="button"
            onClick={() => commit(rows)}
            className="rounded-lg border px-2.5 py-1 text-xs hover:bg-neutral-50"
            title="Normalize & dedupe"
          >
            Clean
          </button>
        </div>
      </div>

      {bulkOpen ? (
        <div className="grid gap-2">
          <textarea
            rows={6}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`One per line or CSV (e.g. 10" x 12", 10x12, 10.5×12.25)`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyBulk}
              className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-neutral-500">No sizes yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((it, i) => {
            const valid = it.trim() === "" ? true : SIZE_RE.test(it.trim());
            return (
              <li key={`${it}-${i}`} className="flex items-start gap-2">
                <span className="w-5 shrink-0 text-xs text-neutral-500">{i + 1}.</span>
                <div className="flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={it}
                    onChange={(e) => replaceAt(i, e.target.value)}
                    onBlur={() => blurAt(i)}
                    placeholder={`e.g. 10" x 12"`}
                    pattern={SIZE_PATTERN}
                    title={`Enter size like 10" x 12", 10x12, 10 in x 12 in, 10.5×12.25`}
                    className={[
                      "w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition",
                      valid
                        ? "border-neutral-300 focus:border-neutral-400 focus:ring-4 focus:ring-black/5"
                        : "border-red-400 focus:ring-4 focus:ring-red-400",
                    ].join(" ")}
                  />
                  <div className="mt-1 text-xs">
                    {valid ? (
                      <span className="text-neutral-500">
                        Accepted: <code>10&quot; x 12&quot;</code>, <code>10x12</code>,{" "}
                        <code>10 in x 12 in</code>, <code>10.5×12.25</code>
                      </span>
                    ) : (
                      <span className="text-red-600">
                        Invalid. Try <code>10&quot; x 12&quot;</code>
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-1">
                <button
  type="button"
  className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => move(i, -1)}
  disabled={i === 0}
  title="Move up"
>
  ↑
</button>

<button
  type="button"
  className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50"
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => move(i, 1)}
  disabled={i === rows.length - 1}
  title="Move down"
>
  ↓
</button>

<button
  type="button"
  className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => removeAt(i)}
  title="Remove"
>
  ✕
</button>

                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={addRef}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5"
          placeholder={`Add size… (e.g. 10" x 12")`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOne((e.target as HTMLInputElement).value);
            }
          }}
        />
        <button
          type="button"
          className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/90"
          onClick={() => addOne(addRef.current?.value || "")}
        >
          Add
        </button>
      </div>
    </div>
  );
}
