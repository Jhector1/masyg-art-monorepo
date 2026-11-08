"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
type SavedEditorFields = {
  title: string;
  description: string;
  categoryIds: string[];
  variants: Record<string, DraftVariant>;
  offersDigitalLicenses: boolean;
  offersFraming: boolean;
  offersGlazing: boolean;
};
const savedFields = (listing: EditorListing): SavedEditorFields => ({
  title: listing.product.title,
  description: listing.product.description,
  categoryIds: listing.product.categories.map(c => c.categoryId),
  variants: Object.fromEntries(listing.product.variants.map(v => [v.id, details(v)])),
  offersDigitalLicenses: listing.product.offersDigitalLicenses,
  offersFraming: listing.product.offersFraming,
  offersGlazing: listing.product.offersGlazing,
});
type EditorTab = "overview" | "offerings" | "media" | "editions" | "options" | "publish";
type NavigationIntent = { kind: "step"; target: EditorTab } | { kind: "leave"; href: string };
const tabs: { id: EditorTab; label: string; hint: string; description: string }[] = [
  { id: "overview", label: "Overview", hint: "Product details", description: "Start with the name, description and categories buyers will see." },
  { id: "offerings", label: "Ways to sell", hint: "Product types", description: "Organize downloads, originals, prints or goods without changing their checkout behavior." },
  { id: "media", label: "Media & files", hint: "Previews and downloads", description: "Add public previews, then attach private downloads to their digital editions." },
  { id: "editions", label: "Editions", hint: "Prices and availability", description: "Set prices and availability for each purchasable digital or physical edition." },
  { id: "options", label: "Options", hint: "Licenses and print choices", description: "Configure only the choices that apply to this product." },
  { id: "publish", label: "Review & publish", hint: "Store visibility", description: "Check what is ready, then publish the catalog product and its store listing separately." },
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
  const [saved, setSaved] = useState<SavedEditorFields>(() => savedFields(listing));
  const savedRef = useRef(saved);
  const [navigationIntent, setNavigationIntent] = useState<NavigationIntent | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saveConfirmedAt, setSaveConfirmedAt] = useState<number | null>(null);
  const [confirmArchive, setConfirmArchive] = useState("");
  const [offersDigitalLicenses, setOffersDigitalLicenses] = useState(listing.product.offersDigitalLicenses);
  const [offersFraming, setOffersFraming] = useState(listing.product.offersFraming);
  const [offersGlazing, setOffersGlazing] = useState(listing.product.offersGlazing);
  const [showNewLicense, setShowNewLicense] = useState(false);
  const [showNewPrint, setShowNewPrint] = useState(false);
  const [showPrintCustomization, setShowPrintCustomization] = useState(() =>
    listing.product.offersFraming || listing.product.offersGlazing || listing.product.variants.some(v =>
      v.fulfillment === "PHYSICAL" && !!(attr(v.attributes, "frame") || attr(v.attributes, "glazing"))));
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
  const pendingLicenseChange = offersDigitalLicenses !== saved.offersDigitalLicenses;
  const pendingPhysicalChange = offersFraming !== saved.offersFraming || offersGlazing !== saved.offersGlazing;
  const licenseDuplicate = duplicateLicenseTier(digital,newLicense);
  const printDuplicate = physical.some(v =>
    (["size", "material", "finish", "frame", "glazing"] as const).every((key, i) =>
      attr(v.attributes, key).trim().toLowerCase() ===
      [newPrintSize, newPrintMaterial, newPrintFinish, newPrintFrame, newPrintGlazing][i].trim().toLowerCase()));
  const index = tabs.findIndex(tab => tab.id === section);
  const overviewDirty = title !== saved.title || description !== saved.description;
  const categoriesDirty = selectedCategories.length !== saved.categoryIds.length ||
    selectedCategories.some(id => !saved.categoryIds.includes(id));
  const editionDirty = listing.product.variants.some(v =>
    JSON.stringify(drafts[v.id] ?? details(v)) !== JSON.stringify(saved.variants[v.id] ?? details(v)));
  const unsavedChanges = overviewDirty || categoriesDirty || editionDirty || pendingLicenseChange || pendingPhysicalChange || showNewLicense || showNewPrint;
  const firstUnsavedStep: EditorTab = overviewDirty || categoriesDirty ? "overview" : editionDirty ? "editions" : "options";
  const savingStatus = busy ? "Saving or processing…" : unsavedChanges ? "Unsaved changes" : saveConfirmedAt ? "Saved" : "No unsaved changes";
  const sectionDirty = section === "overview" ? (overviewDirty || categoriesDirty)
    : section === "editions" ? editionDirty
      : section === "options" ? (pendingLicenseChange || pendingPhysicalChange || showNewLicense || showNewPrint) : false;
  const showDigitalOptions = digital.length > 0;
  const mediaStepDescription = showDigitalOptions
    ? "Add public product images and attach private files to digital editions."
    : "Upload product photos buyers can see. Private download files are only needed for digital editions.";
  const readiness = [
    ...(listing.product.media.length ? [] : [{ label: "Add a public preview", detail: "Recommended for a useful public product page.", tab: "media" as EditorTab, level: "recommendation" as const }]),
    ...(activeDigitalMissingFile.length ? [{ label: "Attach private digital files", detail: `${activeDigitalMissingFile.length} active download edition(s) need files.`, tab: "media" as EditorTab, level: "attention" as const }] : []),
    ...(showDigitalOptions && digitalEligibleForStore.length === 0 ? [{ label: "Review download availability", detail: "No active digital edition currently qualifies for sale; check files, activation and licenses.", tab: "editions" as EditorTab, level: "attention" as const }] : []),
    ...(physical.length > 0 && activePhysical.length === 0 ? [{ label: "Review physical availability", detail: "All physical editions are inactive; inventory is checked separately.", tab: "editions" as EditorTab, level: "attention" as const }] : []),
    ...(showDigitalOptions && listing.product.offersDigitalLicenses && !licenseReady ? [{ label: "Complete digital license setup", detail: "Check active license tiers and private files.", tab: "options" as EditorTab, level: "attention" as const }] : []),
    ...(duplicatedTiers.length ? [{ label: "Resolve duplicate license tiers", detail: duplicatedTiers.map(licenseLabel).join(", "), tab: "editions" as EditorTab, level: "attention" as const }] : []),
    ...(listing.product.offersFraming && !physicalOptionReady("frame") ? [{ label: "Review frame configurations", detail: "At least two active physical frame choices are required.", tab: "options" as EditorTab, level: "attention" as const }] : []),
    ...(listing.product.offersGlazing && !physicalOptionReady("glazing") ? [{ label: "Review glazing configurations", detail: "At least two active physical glazing choices are required.", tab: "options" as EditorTab, level: "attention" as const }] : []),
    ...(unsavedChanges ? [{ label: "Save pending edits", detail: "The catalog still uses previously saved settings.", tab: firstUnsavedStep, level: "attention" as const }] : []),
  ];

  // Server refreshes can update saved product data without remounting this editor.
  // Keep an explicit saved baseline so a successful Save & Continue does not depend
  // on how quickly router.refresh() delivers new server components.
  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => {
    const previous = savedRef.current;
    const fresh = savedFields(listing);
    // Refresh untouched inputs when a child editor updates the product. Preserve
    // anything the merchant has typed but not saved.
    setTitle(current => current === previous.title ? fresh.title : current);
    setDescription(current => current === previous.description ? fresh.description : current);
    setSelectedCategories(current => current.length === previous.categoryIds.length &&
      current.every(id => previous.categoryIds.includes(id)) ? [...fresh.categoryIds] : current);
    setDrafts(current => {
      const next = { ...current };
      for (const [id, edition] of Object.entries(fresh.variants)) {
        if (!previous.variants[id] || JSON.stringify(current[id] ?? previous.variants[id]) === JSON.stringify(previous.variants[id])) {
          next[id] = edition;
        }
      }
      return next;
    });
    setOffersDigitalLicenses(current => current === previous.offersDigitalLicenses ? fresh.offersDigitalLicenses : current);
    setOffersFraming(current => current === previous.offersFraming ? fresh.offersFraming : current);
    setOffersGlazing(current => current === previous.offersGlazing ? fresh.offersGlazing : current);
    savedRef.current = fresh;
    setSaved(fresh);
  }, [listing]);

  useEffect(() => {
    if (!unsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedChanges]);

  // Next.js client navigation may not trigger beforeunload. Intercept normal
  // same-tab, same-origin link clicks, including links in the outer Admin header.
  useEffect(() => {
    if (!unsavedChanges) return;
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.protocol !== "http:" && destination.protocol !== "https:") return;
      if (destination.origin !== current.origin || destination.href === current.href) return;
      if (destination.pathname === current.pathname && destination.search === current.search) return;
      event.preventDefault();
      event.stopPropagation();
      setNavigationIntent({ kind: "leave", href: destination.pathname + destination.search + destination.hash });
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [unsavedChanges]);

  useEffect(() => { if (navigationIntent) stayButtonRef.current?.focus(); }, [navigationIntent]);

  function goTo(tab: EditorTab) {
    setSection(tab);
    setError("");
    setSuccess("");
    window.requestAnimationFrame(() => {
      document.getElementById("zd-editor-workspace")?.scrollIntoView({ block: "start", behavior: "smooth" });
      document.getElementById("zd-editor-step-title")?.focus({ preventScroll: true });
    });
  }

  function navigate(tab: EditorTab) {
    if (busy || tab === section) return;
    if (sectionDirty) { setNavigationIntent({ kind: "step", target: tab }); return; }
    goTo(tab);
  }

  function discardCurrentStep() {
    if (section === "overview") {
      setTitle(saved.title); setDescription(saved.description); setSelectedCategories([...saved.categoryIds]);
    } else if (section === "editions") {
      setDrafts(previous => ({ ...previous, ...saved.variants }));
    } else if (section === "options") {
      setOffersDigitalLicenses(saved.offersDigitalLicenses);
      setOffersFraming(saved.offersFraming); setOffersGlazing(saved.offersGlazing);
      setShowNewLicense(false); setShowNewPrint(false);
    }
  }

  async function execute(work: () => Promise<unknown>, message: string, onSuccess?: () => void): Promise<boolean> {
    if (busy || !canEdit) return false;
    setBusy(true); setError(""); setSuccess("");
    try {
      await work();
      onSuccess?.();
      setSuccess(message);
      setSaveConfirmedAt(Date.now());
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes");
      // If a multi-part save completed an earlier request, re-read server state.
      // Each completed part updates the saved baseline independently.
      router.refresh();
      return false;
    } finally { setBusy(false); }
  }

  function editionPayload(v: EditorVariant, d: DraftVariant) {
    const priceMinor = toMinor(d.price);
    const compareAtMinor = d.compareAt.trim() === "" ? null : toMinor(d.compareAt);
    if (!d.name.trim() || priceMinor === null || (compareAtMinor !== null && compareAtMinor <= priceMinor) || v.currency !== "USD") {
      throw new Error(`Check the name and price for ${v.name}. The optional regular price must be higher.`);
    }
    if (v.fulfillment === "DIGITAL" && d.license && listing.product.variants.some(other =>
      other.id !== v.id && other.fulfillment === "DIGITAL" &&
      (drafts[other.id] ?? details(other)).license.trim().toLowerCase() === d.license.trim().toLowerCase())) {
      throw new Error(`Another digital edition already uses the ${licenseLabel(d.license)} tier. Choose a different tier.`);
    }
    return {
      name: d.name.trim(), sku: d.sku.trim() || null, priceMinor, compareAtMinor, active: d.active,
      attributes: {
        size: d.size.trim(), material: d.material.trim(), format: d.format.trim(), edition: d.edition.trim(), finish: d.finish.trim(),
        ...(v.fulfillment === "PHYSICAL" ? { frame: d.frame.trim(), glazing: d.glazing.trim() } : {}),
        ...(v.fulfillment === "DIGITAL" && d.license ? { license: d.license } : {}),
      },
    };
  }

  async function saveVariant(e: FormEvent<HTMLFormElement>, v: EditorVariant) {
    e.preventDefault();
    const d = drafts[v.id] ?? details(v);
    try {
      const payload = editionPayload(v, d);
      await execute(() => callMerchant(`${productUrl}/variants/${v.id}`, "PATCH", payload), "Edition saved",
        () => setSaved(previous => ({ ...previous, variants: { ...previous.variants, [v.id]: { ...d } } })));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save edition"); }
  }

  async function saveStep(step: EditorTab): Promise<boolean> {
    if (!canEdit || busy) return false;
    if (step === "overview") {
      if (!overviewDirty && !categoriesDirty) return true;
      if (!title.trim() || title.trim().length > 180 || description.length > 10000) {
        setError("Enter a product title (up to 180 characters) and a description up to 10,000 characters.");
        return false;
      }
      const nextTitle = title.trim();
      const nextDescription = description;
      const nextCategories = [...selectedCategories];
      return execute(async () => {
        if (overviewDirty) {
          await callMerchant(productUrl, "PATCH", { title: nextTitle, description: nextDescription });
          setSaved(previous => ({ ...previous, title: nextTitle, description: nextDescription }));
          setTitle(current => current === title ? nextTitle : current);
        }
        if (categoriesDirty) {
          await callMerchant(`${productUrl}/categories`, "PUT", { categoryIds: nextCategories });
          setSaved(previous => ({ ...previous, categoryIds: nextCategories }));
        }
      }, "Overview saved");
    }
    if (step === "editions") {
      const changed = listing.product.variants.filter(v =>
        JSON.stringify(drafts[v.id] ?? details(v)) !== JSON.stringify(saved.variants[v.id] ?? details(v)));
      if (!changed.length) return true;
      // Validate all changed editions before the first network operation.
      let payloads: { variant: EditorVariant; draft: DraftVariant; body: ReturnType<typeof editionPayload> }[];
      try { payloads = changed.map(variant => {
        const draft = { ...(drafts[variant.id] ?? details(variant)) };
        return { variant, draft, body: editionPayload(variant, draft) };
      }); } catch (e) { setError(e instanceof Error ? e.message : "Invalid edition"); return false; }
      return execute(async () => {
        for (const { variant, draft, body } of payloads) {
          await callMerchant(`${productUrl}/variants/${variant.id}`, "PATCH", body);
          setSaved(previous => ({ ...previous, variants: { ...previous.variants, [variant.id]: draft } }));
        }
      }, `${payloads.length} edition(s) saved`);
    }
    if (step === "options") {
      if (showNewLicense || showNewPrint) {
        setError("Create or cancel the open new-edition form before continuing. This step does not silently create new editions.");
        return false;
      }
      if (!pendingLicenseChange && !pendingPhysicalChange) return true;
      if (offersDigitalLicenses && !licenseReady) {
        setError("Complete two distinct active licensed editions with private files before enabling digital license choices.");
        return false;
      }
      if ((offersFraming && !physicalOptionReady("frame")) || (offersGlazing && !physicalOptionReady("glazing"))) {
        setError("Configure at least two valid active frame or glazing choices before enabling those options.");
        return false;
      }
      const nextLicenses = offersDigitalLicenses;
      const nextFraming = offersFraming;
      const nextGlazing = offersGlazing;
      return execute(async () => {
        if (pendingLicenseChange) {
          await callMerchant(productUrl, "PATCH", { offersDigitalLicenses: nextLicenses });
          setSaved(previous => ({ ...previous, offersDigitalLicenses: nextLicenses }));
        }
        if (pendingPhysicalChange) {
          await callMerchant(productUrl, "PATCH", { offersFraming: nextFraming, offersGlazing: nextGlazing });
          setSaved(previous => ({ ...previous, offersFraming: nextFraming, offersGlazing: nextGlazing }));
        }
      }, "Product options saved");
    }
    // Offerings, Media, and nested options managers each have independent Save
    // actions; the editor never claims to persist their unsaved child form state.
    return true;
  }

  async function saveAndGo(tab: EditorTab) {
    if (await saveStep(section)) {
      setNavigationIntent(null);
      goTo(tab);
    }
  }

  function confirmNavigation() {
    if (!navigationIntent || busy) return;
    const intent = navigationIntent;
    setNavigationIntent(null);
    if (intent.kind === "step") {
      discardCurrentStep();
      goTo(intent.target);
    } else {
      router.push(intent.href);
    }
  }

  const buttonTab = (tab: EditorTab, label: string) =>
    <button type="button" className="text-sm font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
      onClick={() => navigate(tab)}>{label}</button>;

  return <div className="space-y-5" id="zd-editor-workspace">
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Product workspace</p>
          <h2 className="mt-1 text-xl font-bold text-zinc-950">{listing.product.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            <Status value={listing.product.status}/><span>Catalog</span><span aria-hidden="true">·</span>
            <Status value={listing.status}/><span>Store listing</span>
            <span role="status" aria-live="polite" className={`rounded-full px-2.5 py-1 font-semibold ${busy ? "bg-blue-100 text-blue-900" : unsavedChanges ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{savingStatus}</span>
          </div>
        </div>
        <Link className={secondary} href={`/merchant/products${storeQuery(store.storeId)}`}>Back to products</Link>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step {index + 1} of {tabs.length}</p>
          <h3 id="zd-editor-step-title" tabIndex={-1} className="mt-1 text-lg font-bold text-zinc-950">{tabs[index].label}</h3>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">{section === "media" ? mediaStepDescription : tabs[index].description}</p></div>
        <span className="text-xs text-zinc-500">Save &amp; Continue saves this step's built-in fields. Uploads and additional managers have their own save actions.</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{width: `${((index + 1) / tabs.length) * 100}%`}}/></div>
      <nav aria-label="Product editing steps" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {tabs.map((tab, step) => <button key={tab.id} id={`zd-editor-tab-${tab.id}`} type="button" disabled={busy}
          aria-current={section === tab.id ? "step" : undefined}
          onClick={() => navigate(tab.id)}
          className={`flex min-w-0 items-start gap-2 rounded-xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${section === tab.id ? "border-indigo-700 bg-indigo-50 text-indigo-950" : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${section === tab.id ? "bg-indigo-700 text-white" : "bg-zinc-100 text-zinc-700"}`}>{step + 1}</span>
          <span className="min-w-0"><span className="block text-sm font-semibold">{tab.label}</span><span className="mt-1 block text-xs text-zinc-500">{tab.id === "media" && !showDigitalOptions ? "Product photos" : tab.id === "options" && !showDigitalOptions ? "Sizes, colors and choices" : tab.hint}</span></span>
        </button>)}
      </nav>
    </div>

    {sectionDirty && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">Unsaved changes in this step. Use Save &amp; Continue to save before moving, or the individual Save buttons below.</p>}
    {section === "publish" && <section aria-label="Publication checklist" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-zinc-950">Review before publishing</h3>
      <p className="mt-1 text-sm text-zinc-600">These are helpful checks, not a replacement for server-side publication validation.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-zinc-50 p-3 text-sm"><span className="block font-semibold">Public gallery</span><span className="text-zinc-600">{listing.product.media.length} preview images</span><div className="mt-1">{buttonTab("media", "Manage previews")}</div></div>
        {showDigitalOptions && <div className="rounded-xl bg-zinc-50 p-3 text-sm"><span className="block font-semibold">Downloads</span><span className="text-zinc-600">{digitalEligibleForStore.length} eligible active digital editions</span><div className="mt-1">{buttonTab("editions", "Review editions")}</div></div>}
        {physical.length > 0 && <div className="rounded-xl bg-zinc-50 p-3 text-sm"><span className="block font-semibold">Physical editions</span><span className="text-zinc-600">{activePhysical.length} active editions (stock verified separately)</span><div className="mt-1">{buttonTab("editions", "Review editions")}</div></div>}
      </div>
      {readiness.length ? <div className="mt-4 space-y-3">
        <p className="text-sm font-semibold text-zinc-800">{readiness.filter(item => item.level === "attention").length} item(s) to review · {readiness.filter(item => item.level !== "attention").length} suggestion(s)</p>
        <details open={readiness.some(item => item.level === "attention")} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Show publication checklist</summary>
          <p className="mt-2 text-xs text-zinc-600">This is editor guidance, not a guarantee of publish eligibility. The server validates publication independently.</p>
          <ul className="mt-3 space-y-2">{readiness.map((item, i) => <li key={`${item.tab}-${i}`} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${item.level === "attention" ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
            <div><strong>{item.label}</strong><p className="mt-1 text-xs text-zinc-600">{item.detail}</p></div>{buttonTab(item.tab, "Open step")}
          </li>)}</ul>
        </details>
      </div> : <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">No issues detected by this checklist. The server still validates publication.</p>}
    </section>}
    {section === "editions" && activeDigitalMissingFile.length > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{activeDigitalMissingFile.length} active digital edition(s) need private files. {buttonTab("media", "Open Media & files")}</p>}

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

    {section === "overview" && <div id="zd-editor-panel-overview" aria-labelledby="zd-editor-tab-overview" className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Basic information</h3><p className="mt-1 text-sm text-zinc-500">What buyers see on the product page.</p>
        <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); const nextTitle = title.trim(), nextDescription = description; void execute(() => callMerchant(productUrl, "PATCH", {title: nextTitle, description: nextDescription}), "Product details saved", () => {
          setSaved(previous => ({...previous, title: nextTitle, description: nextDescription}));
          setTitle(current => current === title ? nextTitle : current);
        }); }}>
          <label className="block text-sm font-medium">Product title<input className={field} required maxLength={180} value={title} disabled={!canEdit} onChange={e => setTitle(e.target.value)}/></label>
          <label className="block text-sm font-medium">Description<textarea className={field} rows={4} maxLength={10000} value={description} disabled={!canEdit} onChange={e => setDescription(e.target.value)}/></label>
          {canEdit && <button className={primary} disabled={busy || !title.trim()}>Save basic information</button>}
        </form>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Categories</h3><p className="mt-1 text-sm text-zinc-500">Optional. Choose where this product appears in category filters.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{categories.map(c => <label key={c.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" disabled={!canEdit} checked={selectedCategories.includes(c.id)} onChange={e => setSelectedCategories(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.name}</label>)}</div>
        {!categories.length && <p className="mt-3 text-sm text-zinc-500">No categories yet. You can create them on the Categories page.</p>}
        {canEdit && <button className={`${secondary} mt-3`} type="button" disabled={busy} onClick={() => { const ids = [...selectedCategories]; void execute(() => callMerchant(`${productUrl}/categories`, "PUT", {categoryIds: ids}), "Categories saved", () => setSaved(previous => ({...previous, categoryIds: ids}))); }}>Save categories</button>}
      </section>
    </div>}

    {section === "offerings" && <div id="zd-editor-panel-offerings" aria-labelledby="zd-editor-tab-offerings">
      <OfferingManager organizationId={store.organizationId} storeId={store.storeId} productId={listing.product.id} canEdit={canEdit}/>
    </div>}

    {section === "media" && <section id="zd-editor-panel-media" aria-labelledby="zd-editor-tab-media" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold">{showDigitalOptions ? "Product images & private downloads" : "Product photos"}</h3>
      {showDigitalOptions
        ? <p className="mt-1 text-sm text-zinc-600">Public gallery images are previews. Files customers purchase as downloads must be uploaded separately as <strong>private files attached to the correct digital edition</strong>.</p>
        : <p className="mt-1 text-sm text-zinc-600">Add photos for this physical product. These images appear in its public gallery; no private download files are needed.</p>}
      <div className="mt-5"><MerchantMediaStudio organizationId={store.organizationId} productId={listing.product.id} media={listing.product.media} variants={listing.product.variants} readOnly={!canEdit}/></div>
    </section>}

    {section === "editions" && <section id="zd-editor-panel-editions" aria-labelledby="zd-editor-tab-editions" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
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

    {section === "options" && <div id="zd-editor-panel-options" aria-labelledby="zd-editor-tab-options" className="space-y-5">
      {physical.length > 0 && <CatalogOptionGroups organizationId={store.organizationId} storeId={store.storeId} productId={listing.product.id} canEdit={canEdit}/>}
      {physical.length > 0 && <details className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"><summary className="cursor-pointer text-sm font-semibold text-zinc-900">Advanced: reusable print sizes</summary><div className="mt-4"><PrintSizeManager organizationId={store.organizationId} storeId={store.storeId} productId={listing.product.id} canEdit={canEdit}/></div></details>}
      {showDigitalOptions && <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm sm:p-6">
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
          onClick={() => { const next = offersDigitalLicenses; void execute(() => callMerchant(productUrl, "PATCH", {offersDigitalLicenses: next}), "Digital license preference saved", () => setSaved(previous => ({...previous, offersDigitalLicenses: next}))); }}>Save license preference</button>}
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
              }), "Inactive license edition created. Upload its private file and activate it in Editions.", () => setShowNewLicense(false));
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
      </section>}
      <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Physical prints and optional customization</h3>
        <p className="mt-1 text-sm text-zinc-600">Physical editions are separately priced and have their own inventory. Digital-only artwork can optionally add physical print editions here.</p>
        {physical.length === 0 && <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">No physical editions yet. Use the add-print action below if you want to sell physical prints alongside downloads.</p>}
        {physical.length > 0 && <div className="mt-4">
          {!showPrintCustomization && <button type="button" className={secondary} onClick={() => setShowPrintCustomization(true)}>Configure frame and glazing choices (optional)</button>}
          {showPrintCustomization && <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="font-semibold">Frame and protective glazing</h4>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canEdit} checked={offersFraming} onChange={e => setOffersFraming(e.target.checked)}/> Offer frame choices</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canEdit} checked={offersGlazing} onChange={e => setOffersGlazing(e.target.checked)}/> Offer protective glazing choices</label>
            <p className="text-sm text-zinc-600">Active physical editions: {activePhysical.length}. Frame choices: {physicalOptionReady("frame") ? "2 or more" : "fewer than 2"}; glazing choices: {physicalOptionReady("glazing") ? "2 or more" : "fewer than 2"}. Each available combination needs its own edition.</p>
            {pendingPhysicalChange && <p role="status" className="text-sm text-amber-800">Changes are not saved yet. The server validates the configured editions.</p>}
            {canEdit && <button type="button" className={secondary} disabled={busy || !pendingPhysicalChange || (offersFraming && !physicalOptionReady("frame")) || (offersGlazing && !physicalOptionReady("glazing"))}
              onClick={() => { const frame = offersFraming, glass = offersGlazing; void execute(() => callMerchant(productUrl, "PATCH", {offersFraming: frame, offersGlazing: glass}), "Print option preferences saved", () => setSaved(previous => ({...previous, offersFraming: frame, offersGlazing: glass}))); }}>Save print option settings</button>}
          </div>}
        </div>}
        {canEdit && <div className="mt-5 border-t border-zinc-200 pt-4">
          {!showNewPrint ? <button type="button" className={secondary} title="Add inactive physical edition" onClick={() => setShowNewPrint(true)}>+ Add priced print configuration</button> :
            <form className="space-y-3" onSubmit={e => {
              e.preventDefault(); const priceMinor = toMinor(newPrintPrice);
              if (priceMinor === null || !newPrintName.trim() || printDuplicate) { setError("Enter a name, valid final price, and a unique physical configuration."); return; }
              void execute(() => callMerchant(`${productUrl}/variants`, "POST", {
                name: newPrintName.trim(), fulfillment: "PHYSICAL", currency: "USD", priceMinor,
                attributes: {size: newPrintSize.trim(), material: newPrintMaterial.trim(), finish: newPrintFinish.trim(), frame: newPrintFrame.trim(), glazing: newPrintGlazing.trim()},
              }), "Inactive print configuration created. Set inventory and activate the edition.", () => setShowNewPrint(false));
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

    {section === "publish" && <div id="zd-editor-panel-publish" aria-labelledby="zd-editor-tab-publish" className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div role="status" className={`mb-4 rounded-xl border p-3 text-sm ${unsavedChanges || readiness.some(item => item.level === "attention") ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          <strong>{unsavedChanges || readiness.some(item => item.level === "attention") ? "Needs attention" : "Ready for server validation"}</strong>
          <p className="mt-1">{unsavedChanges ? "Save the pending changes before any publication action. Use the checklist to open the affected step." : readiness.some(item => item.level === "attention") ? "Review the highlighted setup issues before requesting publication. The server makes the final decision." : "No outstanding editor concerns detected. The server will check publication eligibility when requested."}</p>
        </div>
        <h3 className="text-lg font-semibold">Publication & store visibility</h3>
        <p className="mt-1 text-sm text-zinc-600">The product must be published in the catalog and listed as published in this store. Publishing does not automatically enable payment checkout.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-sm">Catalog</span><Status value={listing.product.status}/><span className="text-sm">Store listing</span><Status value={listing.status}/></div>
        <p className="mt-2 text-sm text-zinc-500">Store path: /{listing.slug}</p>
        {unsavedChanges && <p role="alert" className="mt-3 text-sm font-semibold text-amber-900">Save your pending edits before publishing or changing store visibility.</p>}
        {canEdit && <div className="mt-4 flex flex-wrap gap-3">
          {listing.product.status === "DRAFT" && <button type="button" className={primary} disabled={busy || unsavedChanges} onClick={() => void execute(() => callMerchant(productUrl, "POST"), "Catalog product published")}>Publish product to catalog</button>}
          {listing.product.status === "PUBLISHED" && listing.status !== "PUBLISHED" && listing.status !== "ARCHIVED" && <button type="button" className={primary} disabled={busy || unsavedChanges} onClick={() => void execute(() => callMerchant(`${base}/stores/${store.storeId}/products/${listing.product.id}`, "PATCH", {status: "PUBLISHED"}), "Store listing published")}>Publish store listing</button>}
          {listing.status === "PUBLISHED" && <button type="button" className={secondary} disabled={busy || unsavedChanges} onClick={() => void execute(() => callMerchant(`${base}/stores/${store.storeId}/products/${listing.product.id}`, "PATCH", {status: "DRAFT"}), "Store listing unpublished")}>Unpublish store listing</button>}
        </div>}
      </section>
      {canEdit && listing.product.status !== "ARCHIVED" && <details className="rounded-2xl border border-red-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-red-800">Advanced actions · Archive product</summary>
        <p className="mt-3 text-sm text-red-800">This affects the organization-wide catalog. Historical order snapshots remain intact. Only proceed if you intend to archive this product.</p>
        <label className="mt-3 block text-sm font-medium text-red-900">Type ARCHIVE to confirm<input aria-label="Archive confirmation" className={field} value={confirmArchive} onChange={e => setConfirmArchive(e.target.value)}/></label>
        <button type="button" className="mt-3 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || confirmArchive !== "ARCHIVE"} onClick={() => void execute(async () => {await callMerchant(productUrl, "DELETE"); router.push(`/merchant/products${storeQuery(store.storeId)}`);}, "Product archived")}>Archive product</button>
      </details>}
    </div>}
    <nav aria-label="Product editor next and previous steps" className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:p-4">
      <button type="button" className={secondary} disabled={busy || index === 0} onClick={() => navigate(tabs[index - 1]?.id ?? section)}>← Back</button>
      <div className="text-center"><p className="text-xs font-semibold text-zinc-700">Step {index + 1} of {tabs.length}</p>
        <p role="status" className={`text-xs ${sectionDirty ? "font-semibold text-amber-800" : "text-zinc-600"}`}>{sectionDirty ? "Unsaved changes — save before leaving" : savingStatus}</p>
        {error && <p role="alert" className="max-w-sm text-xs font-semibold text-red-700">{error}</p>}
      </div>
      {index < tabs.length - 1 ? <button type="button" className={primary} disabled={busy || (sectionDirty && !canEdit)} onClick={() => {
        const target = tabs[index + 1]?.id ?? section;
        if (sectionDirty) void saveAndGo(target); else navigate(target);
      }}>{busy ? "Saving…" : sectionDirty ? "Save & Continue →" : "Continue →"}</button>
        : <Link className={secondary} href={`/merchant/products${storeQuery(store.storeId)}`}>Finish editing</Link>}
    </nav>
    {navigationIntent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/65 p-4" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="zd-unsaved-title" aria-describedby="zd-unsaved-description" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onKeyDown={event => {
        if (event.key === "Escape" && !busy) { event.preventDefault(); setNavigationIntent(null); }
        if (event.key !== "Tab") return;
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
        if (!buttons.length) return;
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
      }}>
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Unsaved product edits</p>
        <h3 id="zd-unsaved-title" className="mt-2 text-xl font-bold text-zinc-950">{navigationIntent.kind === "leave" ? "Leave this product?" : "Save before changing steps?"}</h3>
        <p id="zd-unsaved-description" className="mt-3 text-sm text-zinc-700">{navigationIntent.kind === "leave"
          ? "Leaving now discards every unsaved change in this editor. Saved product data is unaffected."
          : "Save & Continue will use the existing merchant APIs, and only move after those requests succeed. Discard will restore the saved values for this step."}</p>
        {navigationIntent.kind === "step" && section === "options" && (showNewLicense || showNewPrint) &&
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Complete or cancel the new-edition form before saving. Discard will close the form without creating an edition.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button ref={stayButtonRef} type="button" className={secondary} disabled={busy} onClick={() => { setNavigationIntent(null); setError(""); }}>Keep editing</button>
          <button type="button" className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={confirmNavigation}>{navigationIntent.kind === "leave" ? "Discard edits & leave" : "Discard this step & move"}</button>
          {navigationIntent.kind === "step" && canEdit && <button type="button" className={primary} disabled={busy} onClick={() => void saveAndGo(navigationIntent.target)}>{busy ? "Saving…" : "Save & move"}</button>}
        </div>
      </div>
    </div>}
    <datalist id="editor-frame-presets">{FRAME_CHOICES.map(label => <option value={label} key={label}/>)}</datalist>
    <datalist id="editor-glazing-presets">{GLAZING_CHOICES.map(label => <option value={label} key={label}/>)}</datalist>
  </div>;
}
