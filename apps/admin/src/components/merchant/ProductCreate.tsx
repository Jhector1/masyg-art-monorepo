"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {FRAME_CHOICES,GLAZING_CHOICES} from "@acme/core/lib/physical-options";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { callMerchant, field, mutatable, primary, secondary, slugify, storeQuery, toMinor, productHref } from "./shared";

type DraftVariant = { name: string; sku: string; price: string; compareAt: string; size: string; material: string; format: string; edition: string; finish: string; frame: string; glazing: string; license: "" | "personal" | "commercial" | "extended"; fulfillment: "PHYSICAL" | "DIGITAL" };
const fresh = (): DraftVariant => ({ name: "Standard", sku: "", price: "12.00", compareAt: "", size: "", material: "", format: "", edition: "", finish: "", frame:"", glazing:"", license:"", fulfillment: "PHYSICAL" });
export default function ProductCreate({ store }: { store: StoreChoice }) {
  const router = useRouter();
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [slug, setSlug] = useState(""); const [manual, setManual] = useState(false);
  const [variants, setVariants] = useState<DraftVariant[]>([fresh()]);
  const [offersDigitalLicenses,setOffersDigitalLicenses] = useState(false);
  const [offersFraming,setOffersFraming] = useState(false);
  const [offersGlazing,setOffersGlazing] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function update(index: number, fieldName: keyof DraftVariant, value: string) {
    setVariants(old => old.map((v, i) => i === index ? { ...v, [fieldName]: value } : v));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!mutatable(store)) return;
    const items = variants.map(v => ({
      name: v.name.trim(), ...(v.sku.trim() ? { sku: v.sku.trim() } : {}),
      fulfillment: v.fulfillment, priceMinor: toMinor(v.price),
      ...(v.compareAt.trim() ? { compareAtMinor: toMinor(v.compareAt) } : {}), currency: "USD",
      attributes: { size: v.size.trim(), material: v.material.trim(), format: v.format.trim(), edition: v.edition.trim(), finish: v.finish.trim(), ...(v.fulfillment === "PHYSICAL" ? {frame:v.frame.trim(),glazing:v.glazing.trim()} : {}), ...(offersDigitalLicenses && v.fulfillment === "DIGITAL" ? { license:v.license } : {}) },
    }));
    if (items.some(v => !v.name || v.priceMinor === null || (v.compareAtMinor !== undefined && (v.compareAtMinor === null || v.priceMinor === null || v.compareAtMinor <= v.priceMinor))) || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
      setError("Check the URL slug, variant names and USD prices"); return;
    }
    const licensed = variants.filter(v=>v.fulfillment==="DIGITAL");
    if (offersDigitalLicenses && (licensed.length < 2 || licensed.some(v=>!v.license) || new Set(licensed.map(v=>v.license)).size < 2)) {
      setError("Add at least two digital variants with different license tiers and their own prices");return;
    }
    setBusy(true); setError("");
    try {
      const product = await callMerchant(`/api/merchant/organizations/${store.organizationId}/stores/${store.storeId}/products`, "POST", { title: title.trim(), description, slug, offersDigitalLicenses, offersFraming, offersGlazing, variants: items }) as { id: string };
      if (!product?.id) throw new Error("Product created, but no ID was returned");
      router.push(productHref(store.storeId, product.id)); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create product"); }
    finally { setBusy(false); }
  }
  if (!mutatable(store)) return <p className="rounded-xl bg-amber-50 p-5 text-sm">This account has read-only catalog access.</p>;
  return <form className="space-y-6" onSubmit={e => void submit(e)}>
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Product details</h2>
      <label className="block text-sm font-medium">Title<input className={field} required maxLength={180} value={title} onChange={e => { setTitle(e.target.value); if (!manual) setSlug(slugify(e.target.value)); }} /></label>
      <label className="block text-sm font-medium">URL slug<input className={field} required maxLength={63} value={slug} onChange={e => { setSlug(e.target.value); setManual(true); }} /></label>
      <label className="block text-sm font-medium">Description<textarea className={field} rows={5} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    </section>
    <section className="rounded-2xl border border-purple-200 bg-white p-5">
      <label className="flex items-start gap-3 font-semibold text-sm"><input type="checkbox" className="mt-1" checked={offersDigitalLicenses} onChange={e=>setOffersDigitalLicenses(e.target.checked)}/>
        <span>Offer license choices for digital downloads<span className="block mt-1 font-normal text-zinc-600">Enable only if buyers can choose Personal, Commercial or Extended usage. Create a separately priced digital variant for each license offered; attach private download files after creation.</span></span>
      </label>
    </section>
    <section className="rounded-2xl border border-purple-200 bg-white p-5 space-y-3">
      <h2 className="font-semibold">Physical print customizations</h2>
      <p className="text-sm text-zinc-600">Optional per product. Each offered size/material/frame/glazing combination must have a separate published physical edition with its final price and inventory. These are not add-on fees.</p>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={offersFraming} onChange={e=>setOffersFraming(e.target.checked)}/> Offer frame choices</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={offersGlazing} onChange={e=>setOffersGlazing(e.target.checked)}/> Offer protective glazing (glass/acrylic)</label>
    </section>
    <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Sizes, formats and prices</h2><p className="mt-1 text-sm text-zinc-500">Create physical prints, originals, or downloadable editions as separate variants.</p></div><button className={secondary} type="button" disabled={variants.length >= 100} onClick={() => setVariants(v => [...v, { ...fresh(), name: `Option ${v.length + 1}` }])}>Add variant</button></div>
      {variants.map((v, i) => <div key={i} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Variant {i + 1}</h3>{variants.length > 1 && <button className="text-xs font-medium text-red-700" type="button" onClick={() => setVariants(old => old.filter((_, j) => j !== i))}>Remove</button>}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-medium">Name<input className={field} required maxLength={120} value={v.name} onChange={e => update(i, "name", e.target.value)}/></label><label className="text-xs font-medium">Selling price (USD)<input className={field} required inputMode="decimal" value={v.price} onChange={e => update(i, "price", e.target.value)}/></label><label className="text-xs font-medium">Regular price (optional)<input className={field} inputMode="decimal" value={v.compareAt} placeholder="Higher than selling price" onChange={e => update(i, "compareAt", e.target.value)}/></label><label className="text-xs font-medium">SKU<input className={field} maxLength={100} value={v.sku} onChange={e => update(i, "sku", e.target.value)}/></label><label className="text-xs font-medium">Size / dimensions<input className={field} maxLength={80} placeholder="18 × 24 in" value={v.size} onChange={e => update(i, "size", e.target.value)}/></label><label className="text-xs font-medium">Material<input className={field} maxLength={100} placeholder="Canvas / fine art paper" value={v.material} onChange={e => update(i, "material", e.target.value)}/></label><label className="text-xs font-medium">File format<input className={field} maxLength={80} placeholder="Canvas, SVG, PDF…" value={v.format} onChange={e => update(i, "format", e.target.value)}/></label><label className="text-xs font-medium">Edition<input className={field} maxLength={100} placeholder="Original, edition of 50" value={v.edition} onChange={e => update(i, "edition", e.target.value)}/></label><label className="text-xs font-medium">Finish<input className={field} maxLength={100} placeholder="Matte, glossy, framed" value={v.finish} onChange={e => update(i, "finish", e.target.value)}/></label>{v.fulfillment === "PHYSICAL" && <><label className="text-xs font-medium">Frame choice<input list="frame-presets" className={field} maxLength={100} value={v.frame} placeholder="Unframed" onChange={e=>update(i,"frame",e.target.value)}/></label><label className="text-xs font-medium">Protective glazing<input list="glazing-presets" className={field} maxLength={100} value={v.glazing} placeholder="None" onChange={e=>update(i,"glazing",e.target.value)}/></label></>}{offersDigitalLicenses && v.fulfillment === "DIGITAL" && <label className="text-xs font-medium">License for this digital edition<select className={field} required value={v.license} onChange={e=>update(i,"license",e.target.value)}><option value="">Choose a license</option><option value="personal">Personal Use</option><option value="commercial">Commercial Use</option><option value="extended">Extended License</option></select></label>}<label className="text-xs font-medium">Fulfillment<select className={field} value={v.fulfillment} onChange={e => update(i, "fulfillment", e.target.value)}><option value="PHYSICAL">Physical</option><option value="DIGITAL">Digital download</option></select></label></div>
      </div>)}
      <p className="text-xs text-zinc-500">Physical products start with zero inventory. Digital files are attached after creation, on the product editing page. Nothing goes live until product, listing and storefront publication.</p>
    </section>
    <datalist id="frame-presets">{FRAME_CHOICES.map(label=><option value={label} key={label}/>)}</datalist>
    <datalist id="glazing-presets">{GLAZING_CHOICES.map(label=><option value={label} key={label}/>)}</datalist>
    <div className="flex flex-wrap gap-3"><button className={primary} type="submit" disabled={busy || !title.trim() || !slug.trim()}>{busy ? "Creating…" : "Create draft product"}</button><Link className={secondary} href={`/merchant/products${storeQuery(store.storeId)}`}>Cancel</Link></div>
  </form>;
}
