"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FRAME_CHOICES, GLAZING_CHOICES } from "@acme/core/lib/physical-options";
import { duplicateLicenseTier } from "@acme/core/lib/digital-license-policy";
import type { StoreChoice } from "@/lib/merchant-workspace";
import MerchantMediaStudio from "@/components/MerchantMediaStudio";
import OfferingManager from "./OfferingManager";
import CatalogOptionGroups from "./CatalogOptionGroups";
import PrintSizeManager from "./PrintSizeManager";
import { attr, callMerchant, field, mutatable, primary, secondary, Status, storeQuery, toMinor } from "./shared";

export type EditorVariant = {
  id: string; name: string; sku: string | null; priceMinor: number; compareAtMinor: number | null; currency: string;
  active: boolean; fulfillment: "PHYSICAL" | "DIGITAL"; attributes: unknown;
  digitalFiles: { id: string; label: string; retiredAt: string | Date | null; asset: { mimeType: string } }[];
};
export type EditorListing = {
  slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  product: { id: string; title: string; description: string; offersDigitalLicenses: boolean; offersFraming: boolean; offersGlazing: boolean;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; categories: { categoryId: string }[];
    media: { sortOrder: number; altText: string | null; asset: { id: string; mimeType: string } }[];
    variants: EditorVariant[];
  };
};

const details = (variant: EditorVariant) => ({
  name: variant.name, sku: variant.sku ?? "", price: (variant.priceMinor / 100).toFixed(2),
  compareAt: variant.compareAtMinor === null ? "" : (variant.compareAtMinor / 100).toFixed(2), active: variant.active,
  size: attr(variant.attributes, "size"), material: attr(variant.attributes, "material"), format: attr(variant.attributes, "format"),
  edition: attr(variant.attributes, "edition"), finish: attr(variant.attributes, "finish"), frame: attr(variant.attributes, "frame"),
  glazing: attr(variant.attributes, "glazing"), license: attr(variant.attributes, "license"),
});
type DraftVariant = ReturnType<typeof details>;
type EditorTab = "overview" | "offerings" | "media" | "editions" | "options" | "publish";
const tabs: { id: EditorTab; label: string; hint: string }[] = [
  { id: "overview", label: "1. Overview", hint: "Name & categories" },
  { id: "offerings", label: "2. Ways to sell", hint: "Original, print, download, goods" },
  { id: "media", label: "3. Media", hint: "Preview & downloads" },
  { id: "editions", label: "4. Editions", hint: "Price & availability" },
  { id: "options", label: "5. Options", hint: "Sizes, licenses & frames" },
  { id: "publish", label: "6. Publish", hint: "Store visibility" },
];
const hasPrivateFile = (variant: EditorVariant) => variant.digitalFiles.some(file => !file.retiredAt);
const displayPrice = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
const licenseLabel = (key: string) => key === "personal" ? "Personal" : key === "commercial" ? "Commercial" : key === "extended" ? "Extended" : "Unlicensed";

export default function ProductEditor({ store, listing, categories }: { store: StoreChoice; listing: EditorListing; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const canEdit = mutatable(store);
  const [section, setSection] = useState<EditorTab>("overview");
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [title, setTitle] = useState(listing.product.title);
  const [description, setDescription] = useState(listing.product.description);
  const [drafts, setDrafts] = useState<Record<string, DraftVariant>>(() =>
    Object.fromEntries(listing.product.variants.map(v => [v.id, details(v)])));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => listing.product.categories.map(c => c.categoryId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmArchive, setConfirmArchive] = useState("");
  const [offersDigitalLicenses, setOffersDigitalLicenses] = useState(listing.product.offersDigitalLicenses);
  const [offersFraming, setOffersFraming] = useState(listing.product.offersFraming);
  const [offersGlazing, setOffersGlazing] = useState(listing.product.offersGlazing);
  const [showNewLicense, setShowNewLicense] = useState(false);
  const [showNewPrint, setShowNewPrint] = useState(false);
  const [newLicense, setNewLicense] = useState<"personal" | "commercial" | "extended">("personal");
  const [newLicenseName, setNewLicenseName] = useState("Personal SVG");
  const [newLicenseFormat, setNewLicenseFormat] = useState("SVG");
  const [newLicensePrice, setNewLicensePrice] = useState("12.00");
  const [newPrintName, setNewPrintName] = useState("Framed fine art print");
  const [newPrintSize, setNewPrintSize] = useState("16 x 20 in");
  const [newPrintMaterial, setNewPrintMaterial] = useState("Fine art paper");
  const [newPrintFinish, setNewPrintFinish] = useState("Matte");
  const [newPrintFrame, setNewPrintFrame] = useState("Black wood");
  const [newPrintGlazing, setNewPrintGlazing] = useState("UV acrylic");
  const [newPrintPrice, setNewPrintPrice] = useState("65.00");
  const base = `/api/merchant/organizations/${store.organizationId}`;
  const productUrl = `${base}/products/${listing.product.id}`;
  const digital = listing.product.variants.filter(v => v.fulfillment === "DIGITAL");
  const physical = listing.product.variants.filter(v => v.fulfillment === "PHYSICAL");
  const activeDigital = digital.filter(v => v.active);
  const activePhysical = physical.filter(v => v.active);
  const activeLicenseTiers = new Set(activeDigital.map(v => attr(v.attributes, "license")).filter(Boolean));
  const activeDigitalMissingFile = activeDigital.filter(v => !hasPrivateFile(v));
  const activeDigitalWithoutTier = activeDigital.filter(v => !attr(v.attributes, "license"));
  const licenseReady = activeLicenseTiers.size >= 2 && activeLicenseTiers.size === activeDigital.length && !activeDigitalMissingFile.length && !activeDigitalWithoutTier.length;
  const digitalEligibleForStore = activeDigital.filter(v => hasPrivateFile(v) &&
    (!listing.product.offersDigitalLicenses || !!attr(v.attributes, "license")));
  const duplicatedTiers = ["personal","commercial","extended"].filter(tier =>
    digital.filter(v => attr(v.attributes,"license") === tier).length > 1);
  const physicalOptionReady = (key: "frame" | "glazing") => new Set(activePhysical.map(v =>
    attr(v.attributes, key).trim().toLowerCase() || "none")).size >= 2;
  const pendingLicenseChange = offersDigitalLicenses !== listing.product.offersDigitalLicenses;
  const pendingPhysicalChange = offersFraming !== listing.product.offersFraming || offersGlazing !== listing.product.offersGlazing;
  const licenseDuplicate = duplicateLicenseTier(digital,newLicense);
  const printDuplicate = physical.some(v =>
    (["size", "material", "finish", "frame", "glazing"] as const).every((key, i) =>
      attr(v.attributes, key).trim().toLowerCase() ===
      [newPrintSize, newPrintMaterial, newPrintFinish, newPrintFrame, newPrintGlazing][i].trim().toLowerCase()));

  function navigate(tab: EditorTab) {
    setSection(tab);
    setError("");
    setSuccess("");
  }
  async function execute(work: () => Promise<unknown>, message: string) {
    if (busy || !canEdit) return;
    setBusy(true); setError(""); setSuccess("");
    try { await work(); setSuccess(message); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save changes"); }
    finally { setBusy(false); }
  }
  async function saveVariant(e: FormEvent<HTMLFormElement>, v: EditorVariant) {
    e.preventDefault();
    const d = drafts[v.id] ?? details(v);
    const priceMinor = toMinor(d.price);
    const compareAtMinor = d.compareAt.trim() === "" ? null : toMinor(d.compareAt);
    if (!d.name.trim() || priceMinor === null || (compareAtMinor !== null && compareAtMinor <= priceMinor) || v.currency !== "USD") {
      setError("Enter a valid selling price. An optional regular price must be higher."); return;
    }
    if (v.fulfillment === "DIGITAL" && d.license && duplicateLicenseTier(digital,d.license as "personal"|"commercial"|"extended",v.id)) {
      setError(`Another digital edition already uses the ${licenseLabel(d.license)} tier. Choose a different tier.`);
      return;
    }
    await execute(() => callMerchant(`${productUrl}/variants/${v.id}`, "PATCH", {
      name: d.name.trim(), sku: d.sku.trim() || null, priceMinor, compareAtMinor, active: d.active,
      attributes: {
        size: d.size.trim(), material: d.material.trim(), format: d.format.trim(), edition: d.edition.trim(), finish: d.finish.trim(),
        ...(v.fulfillment === "PHYSICAL" ? { frame: d.frame.trim(), glazing: d.glazing.trim() } : {}),
        ...(v.fulfillment === "DIGITAL" && d.license ? { license: d.license } : {}),
      },
    }), "Edition saved");
  }
  const buttonTab = (tab: EditorTab, label: string) =>
    <button type="button" className="text-sm font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
      onClick={() => navigate(tab)}>{label}</button>;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">{listing.product.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            <Status value={listing.product.status}/><span>Catalog</span><span aria-hidden="true">·</span>
            <Status value={listing.status}/><span>Store listing</span>
          </div>
        </div>
        <Link className={secondary} href={`/merchant/products${storeQuery(store.storeId)}`}>Back to products</Link>
      </div>
      <p className="mt-3 text-sm text-zinc-600">Edit one area at a time. Changes are saved per section; existing orders are never rewritten.</p>
      <nav role="tablist" aria-label="Product editor sections" className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {tabs.map(tab => <button key={tab.id} id={`zd-editor-tab-${tab.id}`} role="tab" type="button"
          aria-selected={section === tab.id} aria-controls={`zd-editor-panel-${tab.id}`}
          onClick={() => navigate(tab.id)}
          className={`rounded-xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${section === tab.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100"}`}>
          <span className="block text-sm font-semibold">{tab.label}</span>
          <span className={`mt-1 block text-xs ${section === tab.id ? "text-zinc-200" : "text-zinc-500"}`}>{tab.hint}</span>
        </button>)}
      </nav>
    </div>

    <section aria-label="Product readiness" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="font-semibold text-zinc-950">Storefront readiness</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-zinc-50 p-3 text-sm"><span className="block font-semibold">Gallery</span><span className="text-zinc-600">{listing.product.media.length} public preview images</span><div className="mt-1">{buttonTab("media", "Manage media")}</div></div>
        <div className="rounded-xl bg-zinc-50 p-3 text-sm"><span className="block font-semibold">Digital</span><span className="text-zinc-600">{digitalEligibleForStore.length} eligible active edition{digitalEligibleForStore.length === 1 ? "" : "s"}</span><div className="mt-1">{buttonTab("editions", "Review downloads")}</div></div>
        <div className="rounded-xl bg-zinc-50 p-3 text-sm"><span className="block font-semibold">Physical</span><span className="text-zinc-600">{activePhysical.length} active edition{activePhysical.length === 1 ? "" : "s"} (stock checked separately)</span><div className="mt-1">{buttonTab("editions", "Review prints")}</div></div>
      </div>
      {!digitalEligibleForStore.length && digital.length > 0 && <div role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Digital is not currently purchasable in the storefront.</strong> {listing.product.offersDigitalLicenses
          ? "Check that a licensed digital edition is active and has a private download."
          : "License selection is off, but a single licensed or plain digital download can still be purchased if it has an active edition and private file. Check the download files and activity status."}
        <div className="mt-2 flex gap-4">{buttonTab("options", "Review license setup")}{buttonTab("editions", "Review editions")}</div>
      </div>}
      {duplicatedTiers.length > 0 && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Duplicate licensed editions found: {duplicatedTiers.map(licenseLabel).join(", ")}. Keep one edition per tier; edit the existing inactive drafts instead of creating more.
        {" "}{buttonTab("editions", "Resolve duplicate license tiers")}
      </p>}
      {pendingLicenseChange && <p role="status" className="mt-3 text-sm text-amber-800">License preference is not saved yet. The storefront still uses the previous setting.</p>}
    </section>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

    {section === "overview" && <div role="tabpanel" id="zd-editor-panel-overview" aria-labelledby="zd-editor-tab-overview" className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Basic information</h3><p className="mt-1 text-sm text-zinc-500">What buyers see on the product page.</p>
        <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); void execute(() => callMerchant(productUrl, "PATCH", {title: title.trim(), description}), "Product details saved"); }}>
          <label className="block text-sm font-medium">Product title<input className={field} required maxLength={180} value={title} disabled={!canEdit} onChange={e => setTitle(e.target.value)}/></label>
          <label className="block text-sm font-medium">Description<textarea className={field} rows={4} maxLength={10000} value={description} disabled={!canEdit} onChange={e => setDescription(e.target.value)}/></label>
          {canEdit && <button className={primary} disabled={busy || !title.trim()}>Save basic information</button>}
        </form>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Categories</h3><p className="mt-1 text-sm text-zinc-500">Optional. Choose where this product appears in category filters.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{categories.map(c => <label key={c.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" disabled={!canEdit} checked={selectedCategories.includes(c.id)} onChange={e => setSelectedCategories(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div>
        {!categories.length && <p className="mt-3 text-sm text-zinc-500">No categories yet. You can create them on the Categories page.</p>}
        {canEdit && <button className={`${secondary} mt-3`} type="button" disabled={busy} onClick={() => void execute(() => callMerchant(`${productUrl}/categories`, "PUT", {categoryIds: selectedCategories}), "Categories saved")}>Save categories</button>}
      </section>
    </div>}

    {section === "offerings" && <div role="tabpanel" id="zd-editor-panel-offerings" aria-labelledby="zd-editor-tab-offerings">
      <OfferingManager organizationId={store.organizationId} storeId={store.storeId} productId={listing.product.id} canEdit={canEdit}/>
    </div>}

    {section === "media" && <section role="tabpanel" id="zd-editor-panel-media" aria-labelledby="zd-editor-tab-media" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold">Artwork preview & buyer downloads</h3>
      <p className="mt-1 text-sm text-zinc-600">Public gallery images are previews. Digital downloads must be uploaded separately as <strong>private files attached to the correct digital edition</strong>.</p>
      <div className="mt-5"><MerchantMediaStudio organizationId={store.organizationId} productId={listing.product.id} media={listing.product.media} variants={listing.product.variants} readOnly={!canEdit}/></div>
    </section>}

    {section === "editions" && <section role="tabpanel" id="zd-editor-panel-editions" aria-labelledby="zd-editor-tab-editions" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold">Prices, editions & availability</h3>
      <p className="mt-1 text-sm text-zinc-600">An edition is one specific purchasable choice. New editions start inactive. Select <strong>Edit edition</strong> to change price, options or active status; you don't need to edit every field.</p>
      <div className="mt-5 space-y-3">
        {listing.product.variants.map(v => {
          const d = drafts[v.id] ?? details(v);
          const update = (key: keyof DraftVariant, value: string | boolean) => setDrafts(previous => ({...previous, [v.id]: {...d, [key]: value}}));
          const open = editingVariant === v.id;
          return <article key={v.id} className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{v.name}</h4>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.active ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{v.active ? "Active" : "Inactive"}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{v.fulfillment === "DIGITAL" ? "Digital download" : "Physical print"}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{displayPrice(v.priceMinor, v.currency)}
                  {v.fulfillment === "DIGITAL" ? ` · ${licenseLabel(attr(v.attributes, "license"))} · ${attr(v.attributes, "format") || "Format not set"}`
                    : ` · ${[attr(v.attributes, "size"), attr(v.attributes, "material"), attr(v.attributes, "frame")].filter(Boolean).join(" · ") || "No custom options"}`}
                </p>
                {v.fulfillment === "DIGITAL" && !hasPrivateFile(v) && <p className="mt-1 text-xs font-semibold text-amber-800">Private downloadable file missing — {buttonTab("media", "upload file")}</p>}
                {v.fulfillment === "PHYSICAL" && <p className="mt-1 text-xs text-zinc-500">Physical inventory is managed separately on the Inventory page.</p>}
              </div>
              <button type="button" className={secondary} aria-expanded={open} onClick={() => setEditingVariant(open ? null : v.id)}>{open ? "Close editor" : "Edit edition"}</button>
            </div>
            {open && <form className="border-t border-zinc-200 bg-zinc-50 p-4" onSubmit={e => void saveVariant(e, v)}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-medium">Edition name<input className={field} required maxLength={120} disabled={!canEdit} value={d.name} onChange={e => update("name", e.target.value)}/></label>
                <label className="text-sm font-medium">Selling price (USD)<input className={field} required inputMode="decimal" disabled={!canEdit || v.currency !== "USD"} value={d.price} onChange={e => update("price", e.target.value)}/></label>
                <label className="text-sm font-medium">Regular price (optional)<input className={field} inputMode="decimal" placeholder="Must exceed sale price" disabled={!canEdit || v.currency !== "USD"} value={d.compareAt} onChange={e => update("compareAt", e.target.value)}/></label>
                {v.fulfillment === "DIGITAL" ? <>
                  <label className="text-sm font-medium">Download format<input className={field} maxLength={80} disabled={!canEdit} value={d.format} onChange={e => update("format", e.target.value)}/></label>
                  <label className="text-sm font-medium">License tier<select className={field} disabled={!canEdit} value={d.license} onChange={e => update("license", e.target.value)}><option value="">Plain download (no license choices)</option><option value="personal">Personal</option><option value="commercial">Commercial</option><option value="extended">Extended</option></select></label>
                </> : <>
                  <label className="text-sm font-medium">Size<input className={field} disabled={!canEdit} maxLength={80} value={d.size} onChange={e => update("size", e.target.value)}/></label>
                  <label className="text-sm font-medium">Material<input className={field} disabled={!canEdit} maxLength={100} value={d.material} onChange={e => update("material", e.target.value)}/></label>
                  <label className="text-sm font-medium">Finish<input className={field} disabled={!canEdit} maxLength={100} value={d.finish} onChange={e => update("finish", e.target.value)}/></label>
                  <label className="text-sm font-medium">Frame<input className={field} list="editor-frame-presets" disabled={!canEdit} maxLength={100} value={d.frame} onChange={e => update("frame", e.target.value)}/></label>
                  <label className="text-sm font-medium">Protective glazing<input className={field} list="editor-glazing-presets" disabled={!canEdit} maxLength={100} value={d.glazing} onChange={e => update("glazing", e.target.value)}/></label>
                </>}
              </div>
              <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Advanced details (SKU and edition)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">SKU<input className={field} disabled={!canEdit} maxLength={100} value={d.sku} onChange={e => update("sku", e.target.value)}/></label>
                <label className="text-sm font-medium">Edition label<input className={field} disabled={!canEdit} maxLength={100} value={d.edition} onChange={e => update("edition", e.target.value)}/></label>
              </div></details>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canEdit || (v.fulfillment === "DIGITAL" && listing.product.status === "PUBLISHED" && !hasPrivateFile(v))} checked={d.active} onChange={e => update("active", e.target.checked)}/> Make this edition active</label>
              {v.fulfillment === "DIGITAL" && !hasPrivateFile(v) && <p className="mt-1 text-xs text-amber-800">Upload a private file first to activate a digital edition for a published product.</p>}
              {canEdit && <button type="submit" disabled={busy || v.currency !== "USD" || toMinor(d.price) === null} className={`${primary} mt-4`}>Save edition</button>}
            </form>}
          </article>;
        })}
        {!listing.product.variants.length && <p className="text-sm text-amber-800">No editions yet. Create one under Options.</p>}
      </div>
    </section>}

    {section === "options" && <div role="tabpanel" id="zd-editor-panel-options" aria-labelledby="zd-editor-tab-options" className="space-y-5">
      <PrintSizeManager organizationId={store.organizationId} storeId={store.storeId} productId={listing.product.id} canEdit={canEdit}/>
      <CatalogOptionGroups organizationId={store.organizationId} storeId={store.storeId} productId={listing.product.id} canEdit={canEdit}/>
      <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Digital license choices</h3>
        <p className="mt-1 text-sm text-zinc-600">Optional for each product. Buyers choose a real, separately priced digital edition—not a client-side surcharge.</p>
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canEdit} checked={offersDigitalLicenses} onChange={e => setOffersDigitalLicenses(e.target.checked)}/> Offer license choices for digital downloads</label>
        <div role="status" className={`mt-4 rounded-xl border p-4 text-sm ${licenseReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          <strong>{licenseReady ? "Readiness: license editions are ready" : "Readiness: finish these steps before enabling licensing"}</strong>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>{activeLicenseTiers.size} of at least 2 different active license tiers (Personal, Commercial or Extended); no repeated tiers</li>
            <li>{activeDigitalMissingFile.length === 0 ? "All active digital editions have private files" : `${activeDigitalMissingFile.length} active digital edition(s) still need private files`}</li>
            <li>{activeDigitalWithoutTier.length === 0 ? "No unlicensed active editions" : `${activeDigitalWithoutTier.length} active edition(s) need a license tier or deactivation`}</li>
          </ol>
          <div className="mt-2 flex flex-wrap gap-4">{buttonTab("editions", "Edit and activate editions")}{buttonTab("media", "Attach private files")}</div>
        </div>
        {canEdit && <button type="button" className={`${secondary} mt-4`} disabled={busy || !pendingLicenseChange || (offersDigitalLicenses && !licenseReady)}
          onClick={() => void execute(() => callMerchant(productUrl, "PATCH", {offersDigitalLicenses}), "Digital license preference saved")}>Save license preference</button>}
        {canEdit && <div className="mt-5 border-t border-zinc-200 pt-4">
          {!showNewLicense ? <button className={secondary} type="button" title="Add inactive licensed edition" onClick={() => setShowNewLicense(true)}>+ Add license option</button> :
            <form className="space-y-3" onSubmit={e => {
              e.preventDefault(); const priceMinor = toMinor(newLicensePrice);
              if (priceMinor === null || !newLicenseName.trim() || !newLicenseFormat.trim() || licenseDuplicate) {
                setError("Enter a name, format and valid price. Each product can have only one edition per license tier, regardless of format."); return;
              }
              void execute(() => callMerchant(`${productUrl}/variants`, "POST", {
                name: newLicenseName.trim(), fulfillment: "DIGITAL", currency: "USD", priceMinor,
                attributes: {license: newLicense, format: newLicenseFormat.trim()},
              }), "Inactive license edition created. Upload its private file and activate it in Editions.");
            }}>
              <h4 className="text-sm font-semibold">New digital license edition</h4>
              <p className="text-xs text-zinc-500">One edition per license tier. To include SVG and PNG under the same license, attach both private files to that edition. A new edition stays inactive until its files and price are ready.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm font-medium">License<select className={field} value={newLicense} onChange={e => { const tier = e.target.value as "personal" | "commercial" | "extended"; setNewLicense(tier); setNewLicenseName(`${licenseLabel(tier)} ${newLicenseFormat}`); }}><option value="personal">Personal</option><option value="commercial">Commercial</option><option value="extended">Extended</option></select></label>
                <label className="text-sm font-medium">File format<input className={field} maxLength={80} value={newLicenseFormat} onChange={e => setNewLicenseFormat(e.target.value)}/></label>
                <label className="text-sm font-medium">Edition name<input className={field} maxLength={120} required value={newLicenseName} onChange={e => setNewLicenseName(e.target.value)}/></label>
                <label className="text-sm font-medium">Final price (USD)<input className={field} inputMode="decimal" required value={newLicensePrice} onChange={e => setNewLicensePrice(e.target.value)}/></label>
              </div>
              {licenseDuplicate && <p role="alert" className="text-sm text-amber-800">This license tier already exists for the product (even if inactive). Edit that edition or select an unused tier.</p>}
              <div className="flex flex-wrap gap-2"><button className={primary} type="submit" disabled={busy || licenseDuplicate}>Create inactive edition</button><button className={secondary} type="button" onClick={() => setShowNewLicense(false)}>Cancel</button></div>
            </form>}
        </div>}
      </section>
      <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Print frame & protective glazing</h3>
        <p className="mt-1 text-sm text-zinc-600">Only for physical products. Each available combination is a separately priced edition with its own inventory; the storefront cannot sell combinations that have not been configured.</p>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canEdit} checked={offersFraming} onChange={e => setOffersFraming(e.target.checked)}/> Offer frame choices</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canEdit} checked={offersGlazing} onChange={e => setOffersGlazing(e.target.checked)}/> Offer protective glazing choices</label>
        </div>
        <p className="mt-3 text-sm text-zinc-600">Published combinations: {activePhysical.length} active physical editions. Frame choices: {physicalOptionReady("frame") ? "2 or more" : "fewer than 2"}; glazing choices: {physicalOptionReady("glazing") ? "2 or more" : "fewer than 2"}.</p>
        {pendingPhysicalChange && <p className="mt-2 text-sm text-amber-800">These changes are not saved yet. The server checks that sufficient real editions exist before enabling a selector.</p>}
        {canEdit && <button type="button" className={`${secondary} mt-3`} disabled={busy || !pendingPhysicalChange}
          onClick={() => void execute(() => callMerchant(productUrl, "PATCH", {offersFraming, offersGlazing}), "Print option preferences saved")}>Save print option settings</button>}
        {canEdit && <div className="mt-5 border-t border-zinc-200 pt-4">
          {!showNewPrint ? <button type="button" className={secondary} title="Add inactive physical edition" onClick={() => setShowNewPrint(true)}>+ Add priced print configuration</button> :
            <form className="space-y-3" onSubmit={e => {
              e.preventDefault(); const priceMinor = toMinor(newPrintPrice);
              if (priceMinor === null || !newPrintName.trim() || printDuplicate) { setError("Enter a name, valid final price, and a unique physical configuration."); return; }
              void execute(() => callMerchant(`${productUrl}/variants`, "POST", {
                name: newPrintName.trim(), fulfillment: "PHYSICAL", currency: "USD", priceMinor,
                attributes: {size: newPrintSize.trim(), material: newPrintMaterial.trim(), finish: newPrintFinish.trim(), frame: newPrintFrame.trim(), glazing: newPrintGlazing.trim()},
              }), "Inactive print configuration created. Set inventory and activate the edition.");
            }}>
              <h4 className="text-sm font-semibold">New physical print configuration</h4>
              <p className="text-xs text-zinc-500">Price is the <strong>total price of the complete configuration</strong>, not an add-on fee.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-medium">Name<input className={field} maxLength={120} value={newPrintName} onChange={e => setNewPrintName(e.target.value)}/></label>
                <label className="text-sm font-medium">Size<input className={field} maxLength={80} value={newPrintSize} onChange={e => setNewPrintSize(e.target.value)}/></label>
                <label className="text-sm font-medium">Material<input className={field} maxLength={100} value={newPrintMaterial} onChange={e => setNewPrintMaterial(e.target.value)}/></label>
                <label className="text-sm font-medium">Finish<input className={field} maxLength={100} value={newPrintFinish} onChange={e => setNewPrintFinish(e.target.value)}/></label>
                <label className="text-sm font-medium">Frame<select className={field} value={newPrintFrame} onChange={e => setNewPrintFrame(e.target.value)}>{FRAME_CHOICES.map(label => <option key={label} value={label}>{label}</option>)}</select></label>
                <label className="text-sm font-medium">Protective glazing<select className={field} value={newPrintGlazing} onChange={e => setNewPrintGlazing(e.target.value)}>{GLAZING_CHOICES.map(label => <option key={label} value={label}>{label}</option>)}</select></label>
                <label className="text-sm font-medium">Final price (USD)<input className={field} inputMode="decimal" value={newPrintPrice} onChange={e => setNewPrintPrice(e.target.value)}/></label>
              </div>
              {printDuplicate && <p role="alert" className="text-sm text-amber-800">An edition with this exact configuration already exists. Edit that edition instead.</p>}
              <div className="flex flex-wrap gap-2"><button className={primary} type="submit" disabled={busy || printDuplicate}>Create inactive configuration</button><button className={secondary} type="button" onClick={() => setShowNewPrint(false)}>Cancel</button></div>
            </form>}
        </div>}
      </section>
    </div>}

    {section === "publish" && <div role="tabpanel" id="zd-editor-panel-publish" aria-labelledby="zd-editor-tab-publish" className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Publication & store visibility</h3>
        <p className="mt-1 text-sm text-zinc-600">The product must be published in the catalog and listed as published in this store. Publishing does not automatically enable payment checkout.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-sm">Catalog</span><Status value={listing.product.status}/><span className="text-sm">Store listing</span><Status value={listing.status}/></div>
        <p className="mt-2 text-sm text-zinc-500">Store path: /{listing.slug}</p>
        {canEdit && <div className="mt-4 flex flex-wrap gap-3">
          {listing.product.status === "DRAFT" && <button type="button" className={primary} disabled={busy} onClick={() => void execute(() => callMerchant(productUrl, "POST"), "Catalog product published")}>Publish product to catalog</button>}
          {listing.product.status === "PUBLISHED" && listing.status !== "PUBLISHED" && listing.status !== "ARCHIVED" && <button type="button" className={primary} disabled={busy} onClick={() => void execute(() => callMerchant(`${base}/stores/${store.storeId}/products/${listing.product.id}`, "PATCH", {status: "PUBLISHED"}), "Store listing published")}>Publish store listing</button>}
          {listing.status === "PUBLISHED" && <button type="button" className={secondary} disabled={busy} onClick={() => void execute(() => callMerchant(`${base}/stores/${store.storeId}/products/${listing.product.id}`, "PATCH", {status: "DRAFT"}), "Store listing unpublished")}>Unpublish store listing</button>}
        </div>}
      </section>
      {canEdit && listing.product.status !== "ARCHIVED" && <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h3 className="text-lg font-semibold text-red-900">Archive product</h3>
        <p className="mt-1 text-sm text-red-800">This affects the organization-wide catalog. Historical order snapshots remain intact.</p>
        <label className="mt-3 block text-sm font-medium text-red-900">Type ARCHIVE to confirm<input aria-label="Archive confirmation" className={field} value={confirmArchive} onChange={e => setConfirmArchive(e.target.value)}/></label>
        <button type="button" className="mt-3 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || confirmArchive !== "ARCHIVE"} onClick={() => void execute(async () => {await callMerchant(productUrl, "DELETE"); router.push(`/merchant/products${storeQuery(store.storeId)}`);}, "Product archived")}>Archive product</button>
      </section>}
    </div>}
    <datalist id="editor-frame-presets">{FRAME_CHOICES.map(label => <option value={label} key={label}/>)}</datalist>
    <datalist id="editor-glazing-presets">{GLAZING_CHOICES.map(label => <option value={label} key={label}/>)}</datalist>
  </div>;
}
