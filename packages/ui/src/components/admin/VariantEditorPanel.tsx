"use client";

import * as React from "react";
import type { ProductKind, ProductVariant } from "@prisma/client";
import { Field } from "./shared/Field";

const cx = (...s: Array<string | false | null | undefined>) => s.filter(Boolean).join(" ");
const inputBase =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-black/5 disabled:opacity-50 disabled:pointer-events-none";

const STATUS = ["ACTIVE", "RESERVED", "SOLD"] as const;
const TYPES = ["DIGITAL", "PRINT", "ORIGINAL"] as const;
const FP = ["INTERNAL", "PRINTFUL"] as const;

type Props = {
  productId: string;
  kind: ProductKind;
  variants: ProductVariant[];
  onSaved?: () => void;
};

export default function VariantEditorPanel({ productId, kind, variants, onSaved }: Props) {
  if (!variants?.length) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-base font-semibold">Variants</h2>
        <p className="mt-2 text-sm text-neutral-600">No variants yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Variants</h2>
        <span className="text-xs text-neutral-500">Kind: {kind}</span>
      </div>

      <div className="grid gap-4">
        {variants.map((v) => (
          <VariantCard
            key={v.id}
            productId={productId}
            kind={kind}
            variant={v}
            onSaved={onSaved}
          />
        ))}
      </div>
    </section>
  );
}

function VariantCard({
  productId,
  kind,
  variant,
  onSaved,
}: {
  productId: string;
  kind: ProductKind;
  variant: ProductVariant;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [advanced, setAdvanced] = React.useState(false);

  // ----- derived “mode” -----
  const type = (variant.type ?? "DIGITAL") as (typeof TYPES)[number];
  const isOriginal = type === "ORIGINAL";
  const isDigital = type === "DIGITAL";
  const isPrint = type === "PRINT";

  // For merch kinds, we treat it as physical (even if your variant type is PRINT/INTERNAL)
  const isMerch = ["STICKER", "MUG", "CARD", "OTHER"].includes(kind);

  // ----- local draft state -----
  const [draft, setDraft] = React.useState(() => toDraft(variant));

  React.useEffect(() => {
    setDraft(toDraft(variant));
  }, [variant.id]); // reset if a different variant is rendered

  function set<K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(null);

    // attributes JSON safety
    let attributes: any = undefined;
    if (draft.attributesText.trim() === "") {
      attributes = null;
    } else {
      try {
        attributes = JSON.parse(draft.attributesText);
      } catch {
        setBusy(false);
        setErr("Attributes must be valid JSON (or leave blank).");
        return;
      }
    }

    const body: any = {
      type: draft.type,
      status: draft.status,
      inventory: draft.inventory,
      listPrice: draft.listPrice,
      baseCost: draft.baseCost,

      size: draft.size,
      format: draft.format,
      license: draft.license,

      material: draft.material,
      frame: draft.frame,

      widthIn: draft.widthIn,
      heightIn: draft.heightIn,
      depthIn: draft.depthIn,
      year: draft.year,
      medium: draft.medium,
      surface: draft.surface,
      framed: draft.framed,

      sku: draft.sku,
      barcode: draft.barcode,
      upc: draft.upc,
      hsCode: draft.hsCode,
      packQuantity: draft.packQuantity,

      requiresShipping: draft.requiresShipping,

      fulfillmentProvider: draft.fulfillmentProvider,
      printfulVariantId: draft.printfulVariantId,

      attributes,
    };

    const res = await fetch(`/api/admin/products/${productId}/variants/${variant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok || data?.ok === false) {
      setErr(data?.error || `Save failed (${res.status})`);
      return;
    }

    setOk("Saved");
    setTimeout(() => setOk(null), 1500);
    onSaved?.();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge>{type}</Badge>
          <span className="text-xs text-neutral-500">id: {variant.id}</span>
          {ok ? <span className="text-xs text-emerald-700">• {ok}</span> : null}
          {err ? <span className="text-xs text-red-700">• {err}</span> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border px-2.5 py-1 text-xs hover:bg-neutral-50"
            onClick={() => setAdvanced((v) => !v)}
          >
            {advanced ? "Hide advanced" : "Advanced"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Core fields (always useful) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Type">
          <select className={inputBase} value={draft.type} onChange={(e) => set("type", e.target.value as any)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select className={inputBase} value={draft.status} onChange={(e) => set("status", e.target.value as any)}>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Inventory">
          <input
            className={inputBase}
            inputMode="numeric"
            value={draft.inventory}
            onChange={(e) => set("inventory", e.target.value)}
            placeholder={isDigital ? "e.g. (blank = unlimited)" : "e.g. 1"}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="List Price ($)">
          <input className={inputBase} value={draft.listPrice} onChange={(e) => set("listPrice", e.target.value)} />
        </Field>

        {(isPrint || isMerch) && (
          <Field label="Base Cost ($)" help="What Printful charges you (optional).">
            <input className={inputBase} value={draft.baseCost} onChange={(e) => set("baseCost", e.target.value)} />
          </Field>
        )}

        <Field
          label="Shipping override"
          help="Leave blank to inherit Product.requiresShipping"
        >
          <select
            className={inputBase}
            value={draft.requiresShipping}
            onChange={(e) => set("requiresShipping", e.target.value)}
          >
            <option value="">Inherit</option>
            <option value="true">Requires shipping</option>
            <option value="false">No shipping</option>
          </select>
        </Field>
      </div>

      {/* DIGITAL */}
      {isDigital && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-3">
          <div className="mb-2 text-sm font-medium text-neutral-900">Digital options</div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="License">
              <input className={inputBase} value={draft.license} onChange={(e) => set("license", e.target.value)} placeholder="personal / commercial…" />
            </Field>
            <Field label="Size label">
              <input className={inputBase} value={draft.size} onChange={(e) => set("size", e.target.value)} placeholder='e.g. 10" x 12"' />
            </Field>
            <Field label="Format label">
              <input className={inputBase} value={draft.format} onChange={(e) => set("format", e.target.value)} placeholder="PNG / JPG / PDF…" />
            </Field>
          </div>
        </div>
      )}

      {/* PRINT / MERCH */}
      {(isPrint || isMerch) && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-3">
          <div className="mb-2 text-sm font-medium text-neutral-900">Physical / fulfillment</div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Size">
              <input className={inputBase} value={draft.size} onChange={(e) => set("size", e.target.value)} placeholder='e.g. 2" x 2"' />
            </Field>
            <Field label="Material">
              <input className={inputBase} value={draft.material} onChange={(e) => set("material", e.target.value)} placeholder="paper, canvas, vinyl…" />
            </Field>
            <Field label="Frame">
              <input className={inputBase} value={draft.frame} onChange={(e) => set("frame", e.target.value)} placeholder="black, oak…" />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Fulfillment Provider">
              <select className={inputBase} value={draft.fulfillmentProvider} onChange={(e) => set("fulfillmentProvider", e.target.value as any)}>
                {FP.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Printful Variant ID">
              <input className={inputBase} value={draft.printfulVariantId} onChange={(e) => set("printfulVariantId", e.target.value)} placeholder="optional" />
            </Field>

            <Field label="Pack Quantity">
              <input className={inputBase} value={draft.packQuantity} onChange={(e) => set("packQuantity", e.target.value)} placeholder="optional" />
            </Field>
          </div>
        </div>
      )}

      {/* ORIGINAL */}
      {isOriginal && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-3">
          <div className="mb-2 text-sm font-medium text-neutral-900">Original artwork details</div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Width (in)">
              <input className={inputBase} value={draft.widthIn} onChange={(e) => set("widthIn", e.target.value)} />
            </Field>
            <Field label="Height (in)">
              <input className={inputBase} value={draft.heightIn} onChange={(e) => set("heightIn", e.target.value)} />
            </Field>
            <Field label="Depth (in)">
              <input className={inputBase} value={draft.depthIn} onChange={(e) => set("depthIn", e.target.value)} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Medium">
              <input className={inputBase} value={draft.medium} onChange={(e) => set("medium", e.target.value)} placeholder="oil, acrylic…" />
            </Field>
            <Field label="Surface">
              <input className={inputBase} value={draft.surface} onChange={(e) => set("surface", e.target.value)} placeholder="canvas, paper…" />
            </Field>
            <Field label="Year">
              <input className={inputBase} value={draft.year} onChange={(e) => set("year", e.target.value)} placeholder="2025" />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Framed">
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input type="checkbox" checked={draft.framed === "true"} onChange={(e) => set("framed", e.target.checked ? "true" : "false")} />
                Framed
              </label>
            </Field>
            <Field label="Original Serial" help="Optional unique serial.">
              <input className={inputBase} value={draft.originalSerial} onChange={(e) => set("originalSerial", e.target.value)} />
            </Field>
            <Field label="Weight (lb)">
              <input className={inputBase} value={draft.weightLb} onChange={(e) => set("weightLb", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {/* Advanced */}
      {advanced && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-3">
          <div className="mb-2 text-sm font-medium text-neutral-900">Advanced</div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="SKU">
              <input className={inputBase} value={draft.sku} onChange={(e) => set("sku", e.target.value)} />
            </Field>
            <Field label="Barcode">
              <input className={inputBase} value={draft.barcode} onChange={(e) => set("barcode", e.target.value)} />
            </Field>
            <Field label="UPC">
              <input className={inputBase} value={draft.upc} onChange={(e) => set("upc", e.target.value)} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="HS Code">
              <input className={inputBase} value={draft.hsCode} onChange={(e) => set("hsCode", e.target.value)} />
            </Field>
            <Field label="Attributes (JSON)" help='Blank = null. Example: {"color":"red"}'>
              <textarea
                className={cx(inputBase, "min-h-[120px] font-mono")}
                value={draft.attributesText}
                onChange={(e) => set("attributesText", e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function toDraft(v: ProductVariant) {
  const stringify = (x: any) => (x === null || x === undefined ? "" : String(x));

  return {
    type: (v.type ?? "DIGITAL") as any,
    status: (v.status ?? "ACTIVE") as any,

    inventory: stringify(v.inventory),
    listPrice: stringify(v.listPrice),
    baseCost: stringify((v as any).baseCost),

    format: stringify(v.format),
    size: stringify(v.size),
    material: stringify(v.material),
    frame: stringify(v.frame),
    license: stringify(v.license),

    widthIn: stringify(v.widthIn),
    heightIn: stringify(v.heightIn),
    depthIn: stringify((v as any).depthIn),
    weightLb: stringify(v.weightLb),
    year: stringify(v.year),
    medium: stringify(v.medium),
    surface: stringify(v.surface),
    framed: v.framed ? "true" : "false",

    originalSerial: stringify((v as any).originalSerial),

    sku: stringify(v.sku),
    barcode: stringify((v as any).barcode),
    upc: stringify((v as any).upc),
    hsCode: stringify((v as any).hsCode),
    packQuantity: stringify((v as any).packQuantity),

    requiresShipping:
      v.requiresShipping === null || v.requiresShipping === undefined
        ? ""
        : v.requiresShipping
        ? "true"
        : "false",

    fulfillmentProvider: stringify((v as any).fulfillmentProvider || "INTERNAL"),
    printfulVariantId: stringify((v as any).printfulVariantId),

    attributesText: v.attributes ? JSON.stringify(v.attributes, null, 2) : "",
  };
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] leading-5 text-neutral-700">
      {children}
    </span>
  );
}
