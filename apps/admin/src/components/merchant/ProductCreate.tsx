"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FRAME_CHOICES, GLAZING_CHOICES } from "@acme/core/lib/physical-options";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { callMerchant, field, mutatable, primary, secondary, slugify, storeQuery, toMinor, productHref } from "./shared";

type Kind = "DIGITAL_ART" | "PHYSICAL_ART" | "PHYSICAL_GOODS";
type Fulfillment = "PHYSICAL" | "DIGITAL";
type License = "" | "personal" | "commercial" | "extended";
type DraftVariant = {
  name: string; sku: string; price: string; compareAt: string;
  size: string; material: string; format: string; edition: string; finish: string;
  frame: string; glazing: string; license: License; fulfillment: Fulfillment;
};
const steps = ["Product type", "Details", "Editions & prices", "Options", "Review"] as const;
const fresh = (fulfillment: Fulfillment): DraftVariant => ({
  name: fulfillment === "DIGITAL" ? "Digital download" : "Standard", sku: "", price: "", compareAt: "",
  size: "", material: "", format: "", edition: "", finish: "", frame: "", glazing: "", license: "", fulfillment,
});
const cards: { id: Kind; title: string; description: string; icon: string }[] = [
  { id: "DIGITAL_ART", title: "Digital artwork", description: "Downloadable files, optional license choices, and optional physical prints", icon: "🖼️" },
  { id: "PHYSICAL_ART", title: "Physical art & prints", description: "Originals, physical artwork, sizes and editions", icon: "🎨" },
  { id: "PHYSICAL_GOODS", title: "Other physical goods", description: "Stickers, coffee, clothing, and other shipped products", icon: "📦" },
];
const normalize = (value: string) => !value.trim() || ["none", "unframed"].includes(value.trim().toLowerCase()) ? "none" : value.trim().toLowerCase();
function choicesReady(variants: DraftVariant[], choice: "frame" | "glazing") {
  const values = new Set(variants.map(v => normalize(v[choice])));
  return values.size >= 2 && [...values].some(value => value !== "none");
}

function VariantCard({ variant, index, editableLicense, onEdit, onRemove, removable }: {
  variant: DraftVariant; index: number; editableLicense: boolean;
  onEdit: <K extends keyof DraftVariant>(key: K, value: DraftVariant[K]) => void;
  onRemove: () => void; removable: boolean;
}) {
  const digital = variant.fulfillment === "DIGITAL";
  return <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{digital ? "Digital edition" : "Physical edition"} {index + 1}</h3>
      {removable && <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={onRemove}>Remove edition</button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-semibold">Edition name<input className={field} maxLength={120} value={variant.name} placeholder={digital ? "Digital SVG" : "8 × 10 inch print"} onChange={e=>onEdit("name",e.target.value)}/></label>
      <label className="text-xs font-semibold">Selling price (USD)<input className={field} inputMode="decimal" value={variant.price} onChange={e=>onEdit("price",e.target.value)}/></label>
      <label className="text-xs font-semibold">Regular price (optional)<input className={field} inputMode="decimal" value={variant.compareAt} placeholder="Higher than selling price" onChange={e=>onEdit("compareAt",e.target.value)}/></label>
      <label className="text-xs font-semibold">SKU (optional)<input className={field} maxLength={100} value={variant.sku} onChange={e=>onEdit("sku",e.target.value)}/></label>
      {digital ? <>
        <label className="text-xs font-semibold">File format (optional)<input className={field} maxLength={80} placeholder="SVG, PNG, PDF" value={variant.format} onChange={e=>onEdit("format",e.target.value)}/></label>
        <label className="text-xs font-semibold">Edition (optional)<input className={field} maxLength={100} placeholder="Digital original" value={variant.edition} onChange={e=>onEdit("edition",e.target.value)}/></label>
        {editableLicense && <label className="text-xs font-semibold">Buyer license<select className={field} value={variant.license} onChange={e=>onEdit("license",e.target.value as License)}><option value="">Choose a license</option><option value="personal">Personal Use</option><option value="commercial">Commercial Use</option><option value="extended">Extended License</option></select></label>}
      </> : <>
        <label className="text-xs font-semibold">Size or dimensions (optional)<input className={field} maxLength={80} placeholder="8 × 10 in" value={variant.size} onChange={e=>onEdit("size",e.target.value)}/></label>
        <label className="text-xs font-semibold">Material (optional)<input className={field} maxLength={100} placeholder="Canvas, paper, wood" value={variant.material} onChange={e=>onEdit("material",e.target.value)}/></label>
        <label className="text-xs font-semibold">Finish (optional)<input className={field} maxLength={100} placeholder="Matte, glossy" value={variant.finish} onChange={e=>onEdit("finish",e.target.value)}/></label>
        <label className="text-xs font-semibold">Edition (optional)<input className={field} maxLength={100} placeholder="Original, edition of 50" value={variant.edition} onChange={e=>onEdit("edition",e.target.value)}/></label>
      </>}
    </div>
  </div>;
}

export default function ProductCreate({ store }: { store: StoreChoice }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [includePrints, setIncludePrints] = useState(false);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [slug, setSlug] = useState(""); const [manual, setManual] = useState(false);
  const [digitalVariants, setDigitalVariants] = useState<DraftVariant[]>([fresh("DIGITAL")]);
  const [physicalVariants, setPhysicalVariants] = useState<DraftVariant[]>([fresh("PHYSICAL")]);
  const [offersDigitalLicenses, setOffersDigitalLicenses] = useState(false);
  const [offersFraming, setOffersFraming] = useState(false);
  const [offersGlazing, setOffersGlazing] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const modal = confirmationDialog.current;
    if (!modal) return;
    if (confirmOpen && !modal.open) modal.showModal();
    if (!confirmOpen && modal.open) modal.close();
  }, [confirmOpen]);
  useEffect(() => {
    if (error && !confirmOpen) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error, confirmOpen]);
  const digital = kind === "DIGITAL_ART";
  const hasPhysical = kind !== null && (!digital || includePrints);
  const supportsPrintCustomization = kind === "PHYSICAL_ART" || (digital && includePrints);
  const activeVariants = [...(digital ? digitalVariants : []), ...(hasPhysical ? physicalVariants : [])];
  const count = activeVariants.length;

  function update<K extends keyof DraftVariant>(target: Fulfillment, index: number, key: K, value: DraftVariant[K]) {
    const setter = target === "DIGITAL" ? setDigitalVariants : setPhysicalVariants;
    setter(old => old.map((v, i) => i === index ? { ...v, [key]: value } : v));
  }
  function add(target: Fulfillment) {
    if (count >= 100) return;
    const setter = target === "DIGITAL" ? setDigitalVariants : setPhysicalVariants;
    setter(old => [...old, { ...fresh(target), name: `${target === "DIGITAL" ? "Digital" : "Physical"} edition ${old.length + 1}` }]);
  }
  function remove(target: Fulfillment, index: number) {
    const setter = target === "DIGITAL" ? setDigitalVariants : setPhysicalVariants;
    setter(old => old.filter((_, i) => i !== index));
  }
  function toggleLicenses(enabled: boolean) {
    setOffersDigitalLicenses(enabled);
    if (enabled) setDigitalVariants(old => {
      const first = { ...(old[0] ?? fresh("DIGITAL")), license: "personal" as License };
      if (old.length >= 2) return [first, ...old.slice(1)];
      return [{ ...first, name: "Personal use" }, { ...fresh("DIGITAL"), name: "Commercial use", license: "commercial" }];
    });
  }
  function validate(index: number): string | null {
    if (index === 0 && !kind) return "Choose what you are selling to continue.";
    if (index === 1) {
      if (!title.trim() || title.trim().length > 180) return "Enter a product title (up to 180 characters).";
      if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) return "Check the product URL slug; use lower-case letters, numbers and hyphens.";
    }
    if (index === 2) {
      if (!activeVariants.length || activeVariants.length > 100) return "Add at least one priced edition (maximum 100).";
      for (const [i, v] of activeVariants.entries()) {
        const price = toMinor(v.price);
        const regular = v.compareAt.trim() ? toMinor(v.compareAt) : undefined;
        if (!v.name.trim() || v.name.length > 120 || price === null || price > 2147483647 ||
          (regular !== undefined && (regular === null || regular > 2147483647 || regular <= price))) {
          return `Check the name and prices for edition ${i + 1}. Regular price must exceed the selling price.`;
        }
      }
      if (digital && offersDigitalLicenses) {
        const licenses = digitalVariants.map(v => v.license);
        if (licenses.length < 2 || licenses.some(v => !v) || new Set(licenses).size !== licenses.length)
          return "Use at least two digital editions with different license tiers and a separate price for each.";
      }
    }
    if (index === 3) {
      if (supportsPrintCustomization && offersFraming && !choicesReady(physicalVariants, "frame")) return "Framing requires two physical editions with different frame choices. Add editions and choose a frame for each.";
      if (supportsPrintCustomization && offersGlazing && !choicesReady(physicalVariants, "glazing")) return "Glazing requires two physical editions with different glazing choices. Add editions and choose the glazing for each.";
    }
    return null;
  }
  function next() {
    if (busy || step >= steps.length - 1) return;
    const message = validate(step);
    if (message) { setError(message); return; }
    setError("");
    setStep(current => Math.min(current + 1, steps.length - 1));
  }
  function back() { setError(""); setStep(current => Math.max(0, current - 1)); }
  function openConfirmation() { setError(""); setSubmissionError(""); setConfirmOpen(true); }
  function closeConfirmation() { if (busy) return; setConfirmOpen(false); setSubmissionError(""); }

  async function createDraft() {
    // Only the explicit confirmation button in the dialog may send the POST.
    if (!confirmOpen || !mutatable(store) || busy || step !== steps.length - 1) return;
    for (let i = 0; i < 4; i++) { const message = validate(i); if (message) { setConfirmOpen(false); setStep(i); setError(message); return; } }
    const items = activeVariants.map(v => ({
      name: v.name.trim(), ...(v.sku.trim() ? { sku: v.sku.trim() } : {}), fulfillment: v.fulfillment,
      priceMinor: toMinor(v.price), ...(v.compareAt.trim() ? { compareAtMinor: toMinor(v.compareAt) } : {}), currency: "USD",
      attributes: {
        size: v.size.trim(), material: v.material.trim(), format: v.format.trim(), edition: v.edition.trim(), finish: v.finish.trim(),
        ...(v.fulfillment === "PHYSICAL" ? { frame: supportsPrintCustomization && offersFraming ? v.frame.trim() : "", glazing: supportsPrintCustomization && offersGlazing ? v.glazing.trim() : "" } : {}),
        ...(offersDigitalLicenses && v.fulfillment === "DIGITAL" ? { license: v.license } : {}),
      },
    }));
    setBusy(true); setError(""); setSubmissionError("");
    try {
      const product = await callMerchant(`/api/merchant/organizations/${store.organizationId}/stores/${store.storeId}/products`, "POST", {
        title: title.trim(), description, slug, offersDigitalLicenses: digital && offersDigitalLicenses,
        offersFraming: supportsPrintCustomization && offersFraming, offersGlazing: supportsPrintCustomization && offersGlazing, variants: items,
      }) as { id: string };
      if (!product?.id) throw new Error("Product created, but no ID was returned");
      router.push(productHref(store.storeId, product.id)); router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to create product";
      // Keep the confirmation open so a failed API request is not mistaken for a completed create.
      setSubmissionError(message); setError(message);
    } finally { setBusy(false); }
  }

  if (!mutatable(store)) return <p className="rounded-xl bg-amber-50 p-5 text-sm">This account has read-only catalog access.</p>;
  return <form onSubmit={e => e.preventDefault()} className="flex min-h-[calc(100dvh-12rem)] flex-col gap-5 pb-6">
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{steps[step]}</p><p className="text-xs text-zinc-500">Step {step + 1} of {steps.length}</p></div>
      <div className="mt-3 grid grid-cols-5 gap-1" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((label,i)=><div key={label} className={`h-1.5 rounded-full ${i<=step ? "bg-zinc-900" : "bg-zinc-200"}`}/>)}</div>
    </div>
    {error && <p ref={errorRef} role="alert" tabIndex={-1} className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="flex-1 space-y-5">
    {step === 0 && <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
      <div><h2 className="text-xl font-bold">What are you selling?</h2><p className="mt-1 text-sm text-zinc-500">We&apos;ll show only the options needed for your product.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">{cards.map(card=><button type="button" key={card.id} aria-pressed={kind===card.id} onClick={()=>{setKind(card.id);setError("");}}
        className={`rounded-2xl border-2 p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${kind===card.id ? "border-zinc-900 bg-amber-50" : "border-zinc-200 hover:border-zinc-400"}`}>
        <span className="text-3xl" aria-hidden="true">{card.icon}</span><span className="mt-4 block font-bold">{card.title}</span><span className="mt-2 block text-xs leading-5 text-zinc-600">{card.description}</span>
      </button>)}</div>
      {digital && <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold">
        <input type="checkbox" checked={includePrints} onChange={e=>{setIncludePrints(e.target.checked);if(!e.target.checked){setOffersFraming(false);setOffersGlazing(false);}}} /> Also offer physical print editions of this digital artwork
      </label>}
    </section>}
    {step === 1 && <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Describe your product</h2>
      <label className="block text-sm font-semibold">Product title<input className={field} maxLength={180} value={title} placeholder="e.g. Island Dreams" onChange={e=>{setTitle(e.target.value);if(!manual)setSlug(slugify(e.target.value));}}/></label>
      <label className="block text-sm font-semibold">Description (optional)<textarea className={field} rows={4} maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell buyers about your product"/></label>
      <details className="rounded-xl border border-zinc-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Advanced: product URL</summary>
        <label className="mt-3 block text-xs font-semibold">URL slug<input className={field} maxLength={63} value={slug} onChange={e=>{setSlug(e.target.value);setManual(true);}}/></label>
        <p className="mt-2 text-xs text-zinc-500">Automatically generated from the title. Each store uses its own catalog URL.</p>
      </details>
    </section>}
    {step === 2 && <div className="space-y-5">
      {digital && <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div><h2 className="text-xl font-bold">Digital downloads</h2><p className="mt-1 text-sm text-zinc-500">Attach the private downloadable file after creating the draft.</p></div>
        <label className="flex items-start gap-3 rounded-xl bg-purple-50 p-4 text-sm"><input type="checkbox" className="mt-1" checked={offersDigitalLicenses} onChange={e=>toggleLicenses(e.target.checked)}/>
          <span><strong>Let buyers choose a license</strong><span className="mt-1 block text-xs text-zinc-600">Each tier must be a separate digital edition with its own price. One edition per license type.</span></span>
        </label>
        {digitalVariants.map((variant,index)=><VariantCard key={index} variant={variant} index={index} editableLicense={offersDigitalLicenses} onEdit={(key,value)=>update("DIGITAL",index,key,value)} removable={digitalVariants.length>1} onRemove={()=>remove("DIGITAL",index)}/>)}
        <button type="button" className={secondary} disabled={count>=100} onClick={()=>add("DIGITAL")}>+ Add digital edition</button>
      </section>}
      {hasPhysical && <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div><h2 className="text-xl font-bold">{digital ? "Physical print editions" : "Physical products and editions"}</h2><p className="mt-1 text-sm text-zinc-500">Each size or configuration has its own price and physical inventory.</p></div>
        {physicalVariants.map((variant,index)=><VariantCard key={index} variant={variant} index={index} editableLicense={false} onEdit={(key,value)=>update("PHYSICAL",index,key,value)} removable={physicalVariants.length>1} onRemove={()=>remove("PHYSICAL",index)}/>)}
        <button type="button" className={secondary} disabled={count>=100} onClick={()=>add("PHYSICAL")}>+ Add physical edition</button>
      </section>}
    </div>}
    {step === 3 && <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{hasPhysical ? "Physical customization" : "Your digital product"}</h2>
      {!supportsPrintCustomization ? <p className="text-sm text-zinc-600">{digital ? "This is a digital-only product. Frame and glazing options do not apply." : "This product does not need artwork framing or glazing options."} Continue to review.</p> : <>
        <p className="text-sm text-zinc-600">Optional. To offer buyer choices, configure at least two physical editions with different selections. The final variant price includes the complete configuration—these are not extra fees.</p>
        <label className="flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold"><input type="checkbox" checked={offersFraming} onChange={e=>setOffersFraming(e.target.checked)}/> Offer frame choices</label>
        <label className="flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold"><input type="checkbox" checked={offersGlazing} onChange={e=>setOffersGlazing(e.target.checked)}/> Offer protective glazing</label>
        {(offersFraming || offersGlazing) && <div className="space-y-4 rounded-xl bg-zinc-50 p-4">
          <p className="text-xs text-zinc-600">Choose an option for each physical edition. If you need another combination, return to Editions & prices and add it.</p>
          {physicalVariants.map((variant,index)=><div key={index} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm font-bold">{variant.name || `Physical edition ${index+1}`}</p>
            {offersFraming && <label className="text-xs font-semibold">Frame<select className={field} value={variant.frame} onChange={e=>update("PHYSICAL",index,"frame",e.target.value)}><option value="">Choose frame</option>{FRAME_CHOICES.map(option=><option key={option} value={option}>{option}</option>)}</select></label>}
            {offersGlazing && <label className="text-xs font-semibold">Glazing<select className={field} value={variant.glazing} onChange={e=>update("PHYSICAL",index,"glazing",e.target.value)}><option value="">Choose glazing</option>{GLAZING_CHOICES.map(option=><option key={option} value={option}>{option}</option>)}</select></label>}
          </div>)}
          {offersFraming && !choicesReady(physicalVariants,"frame") && <p className="text-xs font-medium text-amber-800">Framing needs at least two physical editions with different frame choices.</p>}
          {offersGlazing && !choicesReady(physicalVariants,"glazing") && <p className="text-xs font-medium text-amber-800">Glazing needs at least two physical editions with different glazing choices.</p>}
          <button type="button" className={secondary} onClick={()=>{setError("");setStep(2);}}>Edit physical editions</button>
        </div>}
      </>}
    </section>}
    {step === 4 && <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Review your draft</h2>
      <div className="space-y-1"><p className="font-semibold">{title}</p><p className="text-sm text-zinc-500">{cards.find(card=>card.id===kind)?.title} · {store.storeName}</p><p className="text-xs text-zinc-500">URL: {slug}</p></div>
      <div className="divide-y rounded-xl border">{activeVariants.map((v,i)=><div key={i} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"><span className="font-semibold">{v.name}<span className="block text-xs font-normal text-zinc-500">{v.fulfillment === "DIGITAL" ? "Digital download" : "Physical"}{offersDigitalLicenses && v.fulfillment === "DIGITAL" && v.license ? ` · ${v.license}` : ""}</span></span><span className="font-bold">${v.price}</span></div>)}</div>
      <div className="space-y-1 text-xs text-zinc-600"><p>License choices: {digital && offersDigitalLicenses ? "Enabled" : "Off"}</p><p>Frames: {supportsPrintCustomization && offersFraming ? "Enabled" : "Off"} · Glazing: {supportsPrintCustomization && offersGlazing ? "Enabled" : "Off"}</p></div>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Creating a draft does not publish anything. After creation, add public images{digital ? ", attach private digital files" : ""}{hasPhysical ? ", configure physical inventory" : ""}, and publish your store listing.</p>
    </section>}
    </div>
    <nav aria-label="Create product step navigation" className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
      <button type="button" className={secondary} onClick={back} disabled={busy || step===0}>← Back</button>
      <div className="flex flex-wrap items-center gap-3">
        <span className="hidden text-xs font-medium text-zinc-500 sm:inline">Step {step + 1} of {steps.length}</span>
        <Link className="text-sm font-medium text-zinc-600 underline underline-offset-4" href={`/merchant/products${storeQuery(store.storeId)}`}>Cancel</Link>
        {step < steps.length-1
          ? <button type="button" className={primary} disabled={busy} onClick={next}>{step === steps.length - 2 ? "Review product →" : "Continue →"}</button>
          : <button type="button" className={primary} disabled={busy} onClick={openConfirmation}>Continue to confirmation →</button>}
      </div>
    </nav>
    <p className="text-center text-xs text-zinc-500">Nothing is created when you click Continue. Review the product and explicitly confirm creation. Leaving this page before creation discards your entries.</p>
    <dialog ref={confirmationDialog} onCancel={e => { if (busy) { e.preventDefault(); return; } closeConfirmation(); }} aria-labelledby="create-confirm-title" aria-describedby="create-confirm-description"
      className="fixed left-1/2 top-1/2 m-0 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/50">
      <h2 id="create-confirm-title" className="text-xl font-bold">Confirm product creation</h2>
      <p id="create-confirm-description" className="mt-2 text-sm text-zinc-600">You are about to create <strong>{title || "this product"}</strong> as an unpublished draft in <strong>{store.storeName}</strong>. It will not be available to buyers yet.</p>
      <p className="mt-2 text-sm text-zinc-600">After creation, you can add product images{digital ? ", private download files" : ""}{hasPhysical ? ", and inventory" : ""} before publishing.</p>
      {submissionError && <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
         <p className="font-semibold">Product was not confirmed as created</p>
         <p className="mt-1 whitespace-pre-line">{submissionError}</p>
         <p className="mt-2 text-xs">Review the error before retrying. If the request may have succeeded, check the product list first to avoid duplicates.</p>
       </div>}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button type="button" className={secondary} disabled={busy} onClick={closeConfirmation}>Go back and edit</button>
        <button type="button" className={primary} disabled={busy} onClick={() => void createDraft()}>{busy ? "Creating draft…" : "Confirm & create draft"}</button>
      </div>
    </dialog>
  </form>;
}
