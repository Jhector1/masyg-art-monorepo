"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { primary, secondary } from "./shared";

type Kind = "PHYSICAL" | "DIGITAL";
type DemoVariant = {
  name: string; fulfillment: Kind; priceMinor: number; compareAtMinor?: number;
  attributes: { size?: string; material?: string; format?: string; edition?: string; finish?: string };
  stock?: number;
};
type DemoSpec = {
  slug: string; title: string; description: string; theme: [string, string, string];
  label: string; images: number; variants: DemoVariant[];
};
type MerchantListing = {
  slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  product: {
    id: string; title: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    media: { asset: { id: string } }[];
    variants: { id: string; name: string; fulfillment: Kind; digitalFiles: { id: string }[] }[];
  };
};
type Location = { id: string; name: string };
const LOCATION = "ZileDigital UI Demo Stock";
const ROOT = "zd-ui-demo-";

/** Stable fixtures. All product names, slugs and sample art are clearly DEMO. */
const FIXTURES: DemoSpec[] = [
  {
    slug: `${ROOT}sunrise-svg`, title: "DEMO · Sunrise Digital Artwork", label: "DIGITAL / SVG",
    description: "Sample downloadable vector artwork. Used to inspect digital-only product presentation and delivery labels.",
    theme: ["#f09b79", "#f9dba8", "#6c3d9f"], images: 2,
    variants: [{ name: "Vector SVG Download", fulfillment: "DIGITAL", priceMinor: 1200,
      attributes: { format: "SVG", edition: "Digital edition" } }],
  },
  {
    slug: `${ROOT}pattern-download`, title: "DEMO · Kreyòl Patterns Download", label: "DIGITAL / MULTI FORMAT",
    description: "Sample digital artwork available as separate PNG and SVG download variants, including a regular-price comparison.",
    theme: ["#306db1", "#97cef0", "#1d2c65"], images: 1,
    variants: [
      { name: "PNG Artwork", fulfillment: "DIGITAL", priceMinor: 700, attributes: { format: "PNG", edition: "Personal download" } },
      { name: "Vector SVG", fulfillment: "DIGITAL", priceMinor: 1300, compareAtMinor: 1700, attributes: { format: "SVG", edition: "Scalable download" } },
    ],
  },
  {
    slug: `${ROOT}fine-art-print`, title: "DEMO · Fine Art Print", label: "PHYSICAL / SIZES",
    description: "Physical sample with two sizes and paper finishes. Used to inspect original size selectors and price changes.",
    theme: ["#aa584c", "#f0b887", "#6a3232"], images: 2,
    variants: [
      { name: "12 × 16 in · Matte", fulfillment: "PHYSICAL", priceMinor: 2800, stock: 12,
        attributes: { size: "12 x 16 in", material: "Fine art paper", finish: "Matte", edition: "Open edition" } },
      { name: "18 × 24 in · Satin", fulfillment: "PHYSICAL", priceMinor: 5600, stock: 5,
        attributes: { size: "18 x 24 in", material: "Archival paper", finish: "Satin", edition: "Open edition" } },
    ],
  },
  {
    slug: `${ROOT}sticker-pack`, title: "DEMO · Caribbean Sticker Pack", label: "PHYSICAL / STICKERS",
    description: "A low-price physical sticker set for checking cart quantities, thumbnails and fulfillment messaging.",
    theme: ["#68b18c", "#cfe3a2", "#206357"], images: 1,
    variants: [{ name: "5-Pack · Vinyl", fulfillment: "PHYSICAL", priceMinor: 650, stock: 30,
      attributes: { material: "Water-resistant vinyl", edition: "5-pack", finish: "Matte" } }],
  },
  {
    slug: `${ROOT}original-canvas`, title: "DEMO · One-of-One Canvas", label: "PHYSICAL / ORIGINAL",
    description: "Single-quantity original physical artwork for one-of-one availability and high-price display testing.",
    theme: ["#482b7a", "#be96cc", "#d1a4e9"], images: 2,
    variants: [{ name: "Original · 20 × 30 in", fulfillment: "PHYSICAL", priceMinor: 35000, stock: 1,
      attributes: { size: "20 x 30 in", material: "Acrylic on canvas", edition: "One-of-one original", finish: "Unframed" } }],
  },
  {
    slug: `${ROOT}mixed-editions`, title: "DEMO · Island Dreams Editions", label: "MIXED / DIGITAL + PRINT",
    description: "One listing with a secure digital download and physical print, to verify both fulfillment kinds render together.",
    theme: ["#edbc58", "#f8e6b2", "#005b73"], images: 2,
    variants: [
      { name: "Download · SVG", fulfillment: "DIGITAL", priceMinor: 1000,
        attributes: { format: "SVG", edition: "Digital edition" } },
      { name: "Fine Art Print · 16 × 20", fulfillment: "PHYSICAL", priceMinor: 4200, stock: 8,
        attributes: { size: "16 x 20 in", material: "Fine art paper", finish: "Matte" } },
    ],
  },
  {
    slug: `${ROOT}sold-out`, title: "DEMO · Sold-Out Lithograph", label: "PHYSICAL / OUT OF STOCK",
    description: "Intentionally out-of-stock physical artwork. Purchase action should remain unavailable.",
    theme: ["#5a657c", "#c4cbd2", "#d97464"], images: 1,
    variants: [{ name: "Limited Edition · 8 × 10", fulfillment: "PHYSICAL", priceMinor: 1800, stock: 0,
      attributes: { size: "8 x 10 in", material: "Lithograph paper", edition: "Limited edition" } }],
  },
];

function demoSvg(spec: DemoSpec): string {
  const [a, b, c] = spec.theme;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1200" viewBox="0 0 960 1200"><rect width="960" height="1200" fill="${b}"/><circle cx="680" cy="370" r="270" fill="${a}"/><path d="M0 780 Q300 420 550 760 T960 660 V1200 H0Z" fill="${c}"/><path d="M0 990 Q260 830 470 970 T960 920 V1200 H0Z" fill="${a}"/><text x="70" y="1110" fill="white" font-family="Arial" font-size="40" font-weight="bold">ZILEDIGITAL · DEMO</text></svg>`;
}

async function canvasFile(spec: DemoSpec, index: number, name = "preview"): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 960; canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable in this browser");
  const [a, b, c] = spec.theme;
  const grad = ctx.createLinearGradient(0, 0, 960, 1200);
  grad.addColorStop(0, b); grad.addColorStop(1, a);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 960, 1200);
  ctx.save(); ctx.translate(index ? 90 : 0, index ? -30 : 0);
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(640, 370, 230, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(-80, 950); ctx.bezierCurveTo(160, 440, 400, 710, 960, 620); ctx.lineTo(1060, 1200); ctx.lineTo(0, 1200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(-30, 1050); ctx.bezierCurveTo(230, 860, 440, 1010, 990, 850); ctx.lineTo(990, 1200); ctx.lineTo(0, 1200); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = "rgba(10,20,25,.72)"; ctx.fillRect(42, 50, 375, 68);
  ctx.fillStyle = "#fff"; ctx.font = "bold 30px Arial, sans-serif"; ctx.fillText("ZILEDIGITAL · DEMO", 66, 94);
  ctx.font = "26px Arial, sans-serif"; ctx.fillText(spec.label, 65, 1135);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(v => v ? resolve(v) : reject(new Error("Unable to render demo PNG")), "image/png"));
  return new File([blob], `${spec.slug}-${name}-${index + 1}.png`, { type: "image/png" });
}

async function jsonApi<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<T> {
  // Every merchant mutation must send JSON, including action-style POSTs
  // such as product publication that do not otherwise require parameters.
  // Authenticated Merchant middleware intentionally rejects bodyless writes.
  const isMutation = method !== "GET";
  const res = await fetch(path, { method, credentials: "same-origin", cache: "no-store",
    ...(isMutation ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) } : {}) });
  const result: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = result && typeof result === "object" && "error" in result ? (result as { error: unknown }).error : null;
    throw new Error(typeof error === "string" ? error : `Merchant API returned ${res.status}`);
  }
  return result as T;
}

async function uploadFile(path: string, file: File, kind: "preview" | "digital", variantId?: string): Promise<void> {
  const form = new FormData();
  form.set("kind", kind); form.set("file", file);
  if (variantId) form.set("variantId", variantId);
  const res = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", body: form });
  const result: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = result && typeof result === "object" && "error" in result ? (result as { error: unknown }).error : null;
    throw new Error(typeof error === "string" ? error : `Media upload returned ${res.status}`);
  }
}

export default function DemoCatalogSeeder({ store, initialOnHand, locations }: {
  store: StoreChoice; initialOnHand: Record<string, number>; locations: Location[];
}) {
  const router = useRouter();
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [failure, setFailure] = useState("");
  const [completed, setCompleted] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);
  const base = `/api/merchant/organizations/${encodeURIComponent(store.organizationId)}`;
  const storeBase = `${base}/stores/${encodeURIComponent(store.storeId)}`;
  const report = (message: string) => setSteps(old => [...old, message]);

  async function seed() {
    if (busy || !approved || !store.organizationId || !store.storeId) return;
    setBusy(true); setFailure(""); setSteps([]); setCompleted(false); setSummary([]);
    try {
      const listingRows = await jsonApi<MerchantListing[]>(`${storeBase}/products`);
      const known = new Map(listingRows.map(row => [row.slug, row]));
      let locationId = locations.find(loc => loc.name === LOCATION)?.id ?? null;
      const existingStock = { ...initialOnHand };
      const outcomes: string[] = [];
      for (const spec of FIXTURES) {
        report(`Processing ${spec.title}`);
        let listing = known.get(spec.slug);
        if (listing && listing.product.title !== spec.title) throw new Error(`Slug ${spec.slug} already belongs to a different product; refusing to change it`);
        if (!listing) {
          const created = await jsonApi<{ id: string }>(`${storeBase}/products`, "POST", {
            title: spec.title, description: spec.description, slug: spec.slug,
            variants: spec.variants.map(v => ({ name: v.name, fulfillment: v.fulfillment, priceMinor: v.priceMinor,
              ...(v.compareAtMinor ? { compareAtMinor: v.compareAtMinor } : {}), currency: "USD", attributes: v.attributes })),
          });
          listing = await jsonApi<MerchantListing>(`${storeBase}/products/${created.id}`);
          // The product-detail endpoint includes variants but omits media/digital-file relationships.
          listing = { ...listing, product: { ...listing.product,
            media: [], variants: listing.product.variants.map(v => ({ ...v, digitalFiles: [] })) } };
          known.set(spec.slug, listing);
          report(`Created ${spec.slug} (draft)`);
        }
        if (listing.status === "ARCHIVED" || listing.product.status === "ARCHIVED") {
          throw new Error(`Demo fixture ${spec.slug} has been archived; refusing to recreate or republish it`);
        }
        const product = listing.product;
        if (product.variants.length !== spec.variants.length ||
            spec.variants.some(v => !product.variants.some(actual => actual.name === v.name && actual.fulfillment === v.fulfillment))) {
          throw new Error(`Demo fixture ${spec.slug} has unexpected variants; refusing to overwrite merchant edits`);
        }
        const mediaUrl = `${base}/products/${product.id}/media`;
        // Upload real public PNGs via the standard Cloudinary pipeline, not fake asset rows.
        for (let i = product.media.length; i < spec.images; i++) {
          await uploadFile(mediaUrl, await canvasFile(spec, i), "preview");
          report(`Uploaded gallery preview ${i + 1}/${spec.images}`);
        }
        for (const variantSpec of spec.variants) {
          const variant = product.variants.find(v => v.name === variantSpec.name && v.fulfillment === variantSpec.fulfillment)!;
          if (variantSpec.fulfillment === "DIGITAL" && variant.digitalFiles.length === 0) {
            const format = variantSpec.attributes.format;
            const file = format === "PNG"
              ? await canvasFile(spec, 0, "download")
              : new File([demoSvg(spec)], `${spec.slug}-${variant.id}.svg`, { type: "image/svg+xml" });
            await uploadFile(mediaUrl, file, "digital", variant.id);
            report(`Attached private ${format || "SVG"} file to ${variantSpec.name}`);
          }
          if (variantSpec.fulfillment === "PHYSICAL" && (variantSpec.stock ?? 0) > 0) {
            if (!locationId) {
              const created = await jsonApi<Location>(`${base}/inventory/locations`, "POST", { name: LOCATION });
              locationId = created.id;
            }
            const held = existingStock[variant.id] ?? 0;
            if (held < variantSpec.stock!) {
              const delta = variantSpec.stock! - held;
              await jsonApi(`${base}/inventory/adjustments`, "POST", {
                storeId: store.storeId, variantId: variant.id, locationId, delta,
                reason: "Initial ZileDigital UI demo fixture stock",
              });
              existingStock[variant.id] = variantSpec.stock!;
              report(`Set sample stock for ${variantSpec.name}: ${variantSpec.stock}`);
            }
          }
        }
        if (product.status !== "PUBLISHED") {
          // The publication route itself needs no fields, but the authenticated
          // merchant write policy requires an explicit JSON request body.
          await jsonApi(`${base}/products/${product.id}`, "POST", {});
          report("Published catalog product");
        }
        if (listing.status !== "PUBLISHED") {
          await jsonApi(`${storeBase}/products/${product.id}`, "PATCH", { status: "PUBLISHED" });
          report("Published store listing");
        }
        outcomes.push(spec.title);
      }
      setSummary(outcomes); setCompleted(true);
      report("Demo catalog complete. No other store's listings were modified.");
      router.refresh();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Unexpected demo-catalog failure");
      report("Stopped on error. Products already created are retained; run again to resume safely.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Seven example products</h2>
      <p className="mt-1 text-sm text-zinc-500">Each example gets a generated, clearly labeled demo artwork preview. Digital editions also receive a separate private downloadable file.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIXTURES.map(spec => <div key={spec.slug} className="flex items-start gap-3 rounded-xl border p-3">
          <span aria-hidden className="mt-1 h-11 w-11 shrink-0 rounded-lg" style={{ background: `linear-gradient(145deg, ${spec.theme[0]}, ${spec.theme[1]}, ${spec.theme[2]})` }} />
          <div><div className="text-sm font-semibold">{spec.title}</div><div className="text-xs text-zinc-500">{spec.label} · {spec.variants.length} {spec.variants.length === 1 ? "variant" : "variants"}</div></div>
        </div>)}
      </div>
      <p className="mt-4 text-xs text-zinc-600">Store: <strong>{store.organizationName} / {store.storeName}</strong>. Existing products—including Haitian Art Print—are never deleted, reset, or repriced. Re-running repairs incomplete demo fixtures without duplicating them.</p>
      {!store.published && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This storefront is not published yet. The demo listings will be published, but the Store page remains private until you publish the storefront under Storefronts.</p>}
      <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={approved} disabled={busy} onChange={e => setApproved(e.target.checked)} className="mt-1" />
        <span>I confirm this is my local development store and understand the example listings will be publicly visible on its published storefront.</span>
      </label>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={primary} disabled={!approved || busy} onClick={() => void seed()}>{busy ? "Creating demo products…" : "Create / resume demo catalog"}</button>
        <a href={`/merchant/products?store=${encodeURIComponent(store.storeId)}`} className={secondary}>Open products</a></div>
    </section>
    {failure && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{failure}</p>}
    {completed && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Created or verified {summary.length} demo product listings. Refresh the public Store page to inspect their original presentation.</div>}
    {steps.length > 0 && <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Progress</h2><ol className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs text-zinc-700">{steps.map((step, i) => <li key={`${i}-${step}`}>{i + 1}. {step}</li>)}</ol></section>}
  </div>;
}
