"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { primary, secondary } from "./merchant/shared";

type Variant = { id: string; name: string; fulfillment: "PHYSICAL" | "DIGITAL"; digitalFiles?: { id: string; label: string; retiredAt?: string | Date | null; asset: { mimeType: string } }[] };
type Image = { sortOrder: number; altText?: string | null; asset: { id: string; mimeType: string } };

/** One product's media studio. First thumbnail is the store-cover image, not an extra field. */
export default function MerchantMediaStudio({ organizationId, productId, media, variants, readOnly = false }: {
  organizationId: string; productId: string; media: Image[]; variants: Variant[]; readOnly?: boolean;
}) {
  const router = useRouter();
  const gallery = [...media].sort((a, b) => a.sortOrder - b.sortOrder || a.asset.id.localeCompare(b.asset.id));
  const signature = gallery.map(m => m.asset.id).join("|");
  const [ids, setIds] = useState(gallery.map(m => m.asset.id));
  const [selected, setSelected] = useState(gallery[0]?.asset.id ?? "");
  useEffect(() => { const ordered = signature ? signature.split("|") : []; setIds(ordered); setSelected(id => ordered.includes(id) ? id : ordered[0] ?? ""); }, [signature]);
  const imgRef = useRef<HTMLInputElement>(null); const digitalRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementPreview, setReplacementPreview] = useState("");
  useEffect(() => {
    if (!replacementFile) { setReplacementPreview(""); return; }
    const url = URL.createObjectURL(replacementFile);
    setReplacementPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [replacementFile]);
  const [altDraft, setAltDraft] = useState("");
  const altSignature = gallery.map(m => `${m.asset.id}:${m.altText ?? ""}`).join("|");
  useEffect(() => { setAltDraft(gallery.find(m => m.asset.id === selected)?.altText ?? ""); }, [selected, altSignature]);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [crop, setCrop] = useState({ x: "0", y: "0", width: "600", height: "600" });
  const [replaceDigitalId, setReplaceDigitalId] = useState("");
  const digitalVariants = variants.filter(v => v.fulfillment === "DIGITAL");
  const [digitalVariantId, setDigitalVariantId] = useState(digitalVariants[0]?.id ?? "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [uploadErrorFor, setUploadErrorFor] = useState<"preview" | "digital" | null>(null);
  const url = `/api/merchant/organizations/${organizationId}/products/${productId}/media`;
  const cover = ids[0];
  const selectedIndex = Math.max(0, ids.indexOf(selected));
  const image = (id: string, thumb: boolean) => `${url}/${encodeURIComponent(id)}${thumb ? "?size=thumb" : ""}`;
  async function perform(action: () => Promise<string>, uploadKind: "preview" | "digital" | null = null) {
    if (busy || readOnly) return;
    setUploadErrorFor(uploadKind);
    setBusy(true); setError(""); setNotice("");
    try { setNotice(await action()); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Media operation failed"); }
    finally { setBusy(false); }
  }
  async function upload(kind: "preview" | "digital", files: FileList | null, variantId?: string, replaceId?: string) {
    setUploadErrorFor(kind); setError(""); setNotice("");
    if (!files?.length) { setError("Choose a file before uploading"); return; }
    const maxSize = kind === "preview" ? 12 * 1024 * 1024 : 40 * 1024 * 1024;
    for (const file of Array.from(files)) {
      if (file.size < 1 || file.size > maxSize) {
        setError(`${file.name}: file must be between 1 byte and ${kind === "preview" ? "12" : "40"} MB.`); return;
      }
    }
    if (kind === "digital" && !variantId) { setError("Choose a digital edition before uploading its private file."); return; }
    if (replaceId && files.length !== 1) { setError("Choose exactly one replacement file"); return; }
    if (kind === "preview" && (files.length > 8 || (!replaceId && ids.length + files.length > 50))) { setError("Maximum 8 images per upload and 50 gallery images"); return; }
    await perform(async () => {
      for (const file of Array.from(files)) {
        const body = new FormData(); body.set("kind", kind); body.set("file", file);
        if (variantId) body.set("variantId", variantId);
        if (replaceId) body.set(kind === "preview" ? "replaceAssetId" : "replaceDigitalFileId", replaceId);
        if (kind === "preview" && replaceId && (rotation || cropEnabled)) {
          const edit: { rotate: number; crop?: { x: number; y: number; width: number; height: number } } = { rotate: rotation };
          if (cropEnabled) {
            const values = Object.fromEntries(Object.entries(crop).map(([key, value]) => [key, Number(value)])) as {x:number;y:number;width:number;height:number};
            if (!Object.values(values).every(Number.isSafeInteger) || values.x < 0 || values.y < 0 || values.width < 1 || values.height < 1) throw new Error("Crop coordinates must be valid source-image pixels");
            edit.crop = values;
          }
          body.set("edit", JSON.stringify(edit));
        }
        const res = await fetch(url, { method: "POST", body, credentials: "same-origin", cache: "no-store" });
        const data: { error?: string; assetId?: string; cleanupPending?: boolean } = await res.json().catch(() => ({}));
        if (!res.ok) {
          const serverMessage = typeof data.error === "string" && data.error.trim() ? data.error : `Upload request failed`;
          throw new Error(`${file.name}: ${serverMessage} (HTTP ${res.status}). ${res.status >= 500 ? "Check the Admin server's Cloudinary configuration and error logs." : "Verify file type, size and the selected digital edition."}`);
        }
        if (kind === "preview" && replaceId && data.assetId) setSelected(data.assetId);
      }
      if (imgRef.current) imgRef.current.value = "";
      if (digitalRef.current) digitalRef.current.value = "";
      if (replaceDigitalId) setReplaceDigitalId("");
      if (replaceRef.current) replaceRef.current.value = "";
      setReplacementFile(null);
      return `${files.length} ${kind === "preview" ? "preview image(s)" : "private digital file(s)"} uploaded`;
    }, kind);
  }
  async function reorder(next: string[]) {
    if (next.join("|") === ids.join("|")) return;
    await perform(async () => {
      const res = await fetch(url, { method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderedAssetIds: next }) });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Reorder failed (${res.status})`);
      setIds(next); return "Gallery order saved";
    });
  }
  async function saveAltText() {
    await perform(async () => {
      const res = await fetch(`${url}/${encodeURIComponent(selected)}`, { method: "PATCH", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ altText: altDraft }) });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Alt text update failed (${res.status})`);
      return "Alternative text saved";
    });
  }
  async function retireDigital(id: string) {
    if (!window.confirm("Retire this file for future purchases? Existing entitled buyers keep access.")) return;
    await perform(async () => {
      const res = await fetch(`/api/merchant/organizations/${organizationId}/products/${productId}/digital-files/${encodeURIComponent(id)}`,
        { method: "DELETE", credentials: "same-origin", cache: "no-store" });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Digital retirement failed (${res.status})`);
      return "File retired for new purchases; existing buyer grants remain valid";
    });
  }
  async function removeImage(id: string) {
    if (!window.confirm("Remove this preview image from the product gallery?")) return;
    await perform(async () => {
      const res = await fetch(`${url}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin", cache: "no-store" });
      const data: { error?: string; cleanupPending?: boolean } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Removal failed (${res.status})`);
      setIds(old => old.filter(x => x !== id));
      setSelected(current => current === id ? ids.find(x => x !== id) ?? "" : current);
      return data.cleanupPending ? "Image detached; Cloudinary cleanup needs an operational retry" : "Image removed from gallery and Cloudinary cleanup completed";
    });
  }
  return <div className="mt-5 space-y-6">
    {error && !uploadErrorFor && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="space-y-3"><div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 sm:min-h-96">
        {selected ? <img src={image(selected, false)} alt={gallery.find(m => m.asset.id === selected)?.altText || "Selected watermarked product preview"} className="max-h-[540px] w-full object-contain" /> : <span className="text-sm text-zinc-400">No product images yet</span>}
        {!!selected && selected === cover && <span className="absolute left-3 top-3 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">Cover image</span>}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-5">{ids.map((id, index) => <button key={id} type="button" onClick={() => setSelected(id)} className={`relative aspect-square overflow-hidden rounded-lg border-2 ${selected === id ? "border-zinc-900" : "border-zinc-200"}`} aria-label={`Select thumbnail ${index + 1}`} aria-pressed={selected === id}>
        <img src={image(id, true)} alt={`Product thumbnail ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />{index === 0 && <span className="absolute bottom-0 inset-x-0 bg-zinc-900/85 py-0.5 text-center text-[10px] text-white">Cover</span>}
      </button>)}</div>
      {!readOnly && !!selected && <div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy || selected === cover} onClick={() => void reorder([selected, ...ids.filter(x => x !== selected)])}>Set as cover</button><button type="button" className={secondary} disabled={busy || selectedIndex === 0} onClick={() => { const next = [...ids]; [next[selectedIndex - 1], next[selectedIndex]] = [next[selectedIndex]!, next[selectedIndex - 1]!]; void reorder(next); }}>Move left</button><button type="button" className={secondary} disabled={busy || selectedIndex === ids.length - 1} onClick={() => { const next = [...ids]; [next[selectedIndex + 1], next[selectedIndex]] = [next[selectedIndex]!, next[selectedIndex + 1]!]; void reorder(next); }}>Move right</button><button type="button" className="rounded-xl px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50" disabled={busy} onClick={() => void removeImage(selected)}>Remove from gallery</button></div>}
      </div>
      <div className="space-y-5"><section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"><h3 className="text-sm font-semibold">Image information</h3>
        <label className="mt-3 block text-xs font-medium">Alternative text<textarea className="mt-1 block w-full rounded-lg border p-2 text-sm" rows={3} maxLength={180} disabled={!selected || busy || readOnly} value={altDraft} onChange={e => setAltDraft(e.target.value)} placeholder="Describe the product image for screen readers" /></label>
        {!readOnly && <button type="button" className={`${secondary} mt-2 w-full`} disabled={!selected || busy} onClick={() => void saveAltText()}>Save alt text</button>}
      </section>
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"><h3 className="text-sm font-semibold">Edit or replace an image</h3><p className="mt-1 text-xs text-zinc-500">Select a new source file; crop and rotation happen before the permanent PREVIEW stamp. Existing watermarked previews cannot be unwatermarked.</p>
        {!readOnly && <><input ref={replaceRef} className="mt-3 block w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !selected} onChange={e => setReplacementFile(e.target.files?.[0] ?? null)}/>
        {replacementPreview && <div className="mt-3 overflow-hidden rounded-lg border bg-white p-3"><p className="mb-2 text-xs text-zinc-600">Local source preview (rotation only; crop coordinates apply during upload)</p><div className="flex h-44 items-center justify-center overflow-hidden bg-zinc-100"><img src={replacementPreview} alt="Local source file before protective watermark" className="max-h-36 max-w-full object-contain" style={{ transform: `rotate(${rotation}deg)` }}/></div></div>}
        <label className="mt-2 block text-xs">Rotation<select className="mt-1 block w-full rounded-lg border p-2 text-sm" disabled={busy} value={rotation} onChange={e => setRotation(Number(e.target.value) as 0 | 90 | 180 | 270)}><option value={0}>None</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select></label>
        <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" disabled={busy} checked={cropEnabled} onChange={e => setCropEnabled(e.target.checked)}/> Crop using source-image pixel coordinates</label>
        {cropEnabled && <div className="mt-2 grid grid-cols-2 gap-2">{(["x","y","width","height"] as const).map(key => <label key={key} className="text-xs capitalize">{key}<input className="mt-1 w-full rounded-lg border p-2" type="number" min={key === "width" || key === "height" ? 1 : 0} max={12000} disabled={busy} value={crop[key]} onChange={e => setCrop(previous => ({...previous,[key]:e.target.value}))}/></label>)}</div>}
        <button type="button" className={`${secondary} mt-3 w-full`} disabled={busy || !selected} onClick={() => void upload("preview", replaceRef.current?.files ?? null, undefined, selected)}>Replace selected preview</button></>}
      </section>
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"><h3 className="text-sm font-semibold">Upload gallery previews</h3><p className="mt-2 text-xs leading-5 text-zinc-600">JPEG, PNG, WebP · 12 MB each · Up to 8 at once. Cloudinary stores watermarked previews; thumbnails are derived from the protected preview, not the original artwork.</p>
        {!readOnly && <><input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-3 block w-full text-xs" disabled={busy} onChange={() => { if (uploadErrorFor === "preview") setError(""); }}/><button type="button" className={`${primary} mt-3 w-full`} disabled={busy} onClick={() => void upload("preview", imgRef.current?.files ?? null)}>{busy ? "Processing…" : "Upload images"}</button></>}
        {error && uploadErrorFor === "preview" && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      </section><p className="text-xs leading-5 text-zinc-500">The first thumbnail is the catalog cover. Changing order updates the canonical ProductMedia sequence for every storefront listing this product.</p></div>
    </div>
    {digitalVariants.length > 0 && <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5"><h3 className="font-semibold">Private digital originals & downloads</h3><p className="mt-1 text-xs text-zinc-500">PDF, SVG, ZIP, JPEG, PNG or WebP · 40 MB each. Files remain private; uploads do not enable buyer downloads or payments.</p>
      {!digitalVariants.length ? <p className="mt-4 text-sm text-zinc-600">Add a DIGITAL variant to attach downloadable files.</p> : <div className="mt-4 space-y-3"><label className="block text-xs font-semibold">Digital variant<select className="mt-1 block w-full max-w-lg rounded-xl border bg-white p-2 text-sm" value={digitalVariantId} onChange={e => { setDigitalVariantId(e.target.value); setReplaceDigitalId(""); }}>{digitalVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <ul className="space-y-2 text-sm">{digitalVariants.find(v => v.id === digitalVariantId)?.digitalFiles?.map(f => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3"><span>{f.label} <span className="text-xs text-zinc-500">({f.asset.mimeType}) · {f.retiredAt ? "Retired for new purchases" : "Active"}</span></span>{!readOnly && !f.retiredAt && <button type="button" disabled={busy} onClick={() => void retireDigital(f.id)} className="text-xs font-medium text-red-700">Retire</button>}</li>)}
          {!digitalVariants.find(v => v.id === digitalVariantId)?.digitalFiles?.length && <li className="text-xs text-zinc-500">No private files attached yet.</li>}</ul>
        {!readOnly && <><label className="block text-xs font-medium">Replace an active file (optional)<select className="mt-1 block w-full max-w-lg rounded-lg border bg-white p-2 text-sm" value={replaceDigitalId} onChange={e => setReplaceDigitalId(e.target.value)}><option value="">Add a new file</option>{digitalVariants.find(v => v.id === digitalVariantId)?.digitalFiles?.filter(f => !f.retiredAt).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
        <p className="text-xs text-zinc-600">Files upload securely to Cloudinary for <strong>{digitalVariants.find(v=>v.id===digitalVariantId)?.name || "the selected digital edition"}</strong>. A public gallery image is not a buyer download. Do not share Cloudinary API keys here.</p>
        <input ref={digitalRef} type="file" aria-label="Select private files for the chosen digital edition" multiple={!replaceDigitalId} accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.zip" className="block w-full text-xs" disabled={busy} onChange={() => { if (uploadErrorFor === "digital") setError(""); }}/><button type="button" disabled={busy || !digitalVariantId} className={secondary} onClick={() => void upload("digital", digitalRef.current?.files ?? null, digitalVariantId, replaceDigitalId || undefined)}>{replaceDigitalId ? "Upload replacement file" : "Upload private files"}</button>
        {error && uploadErrorFor === "digital" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}</>}
      </div>}
    </section>}
  </div>;
}
