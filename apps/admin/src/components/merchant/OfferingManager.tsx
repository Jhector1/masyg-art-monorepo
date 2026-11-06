"use client";
import { useEffect, useState } from "react";
import { callMerchant, field, primary, secondary } from "./shared";

const kindLabels = {
  ORIGINAL: "Original / one-of-a-kind",
  PRINT: "Art print / reproduction",
  DOWNLOAD: "Digital download",
  MERCHANDISE: "Regular merchandise",
} as const;
type Kind = keyof typeof kindLabels;
type Offering = {id:string;kind:Kind;name:string;slug:string;status:string;sortOrder:number};
type Variant = {id:string;offeringId:string|null;name:string;active:boolean;fulfillment:"PHYSICAL"|"DIGITAL"};
type Data = {offerings:Offering[];variants:Variant[]};
const options = Object.keys(kindLabels) as Kind[];
const compatible = (kind:Kind, fulfillment:Variant["fulfillment"]) => (kind === "DOWNLOAD") === (fulfillment === "DIGITAL");
const messageFrom = (error:unknown) => error instanceof Error ? error.message : "Unable to save offering";

export default function OfferingManager({organizationId,storeId,productId,canEdit}:{organizationId:string;storeId:string;productId:string;canEdit:boolean}) {
  const base = `/api/merchant/organizations/${organizationId}/products/${productId}/offerings`;
  const [data,setData] = useState<Data|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [newKind,setNewKind] = useState<Kind>("PRINT");
  const [newName,setNewName] = useState("Art print");
  const [edits,setEdits] = useState<Record<string,{kind:Kind;name:string}>>({});
  const [assignments,setAssignments] = useState<Record<string,string>>({});
  async function load() {
    const response = await fetch(`${base}?storeId=${encodeURIComponent(storeId)}`, {credentials:"same-origin",cache:"no-store"});
    const body:unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `Unable to load ways to sell (${response.status})`);
    const value = body as Data;
    if (!Array.isArray(value.offerings) || !Array.isArray(value.variants)) throw new Error("Invalid offerings response");
    setData(value);
    setEdits(Object.fromEntries(value.offerings.map(item => [item.id,{kind:item.kind,name:item.name}])));
    setAssignments(Object.fromEntries(value.variants.map(item => [item.id,item.offeringId ?? ""])));
  }
  useEffect(() => {
    let alive = true;
    async function start() {
      try {
        const response = await fetch(`${base}?storeId=${encodeURIComponent(storeId)}`, {credentials:"same-origin",cache:"no-store"});
        const body:unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `Unable to load ways to sell (${response.status})`);
        const value = body as Data;
        if (!Array.isArray(value.offerings) || !Array.isArray(value.variants)) throw new Error("Invalid offerings response");
        if (alive) {setData(value);setEdits(Object.fromEntries(value.offerings.map(item=>[item.id,{kind:item.kind,name:item.name}])));setAssignments(Object.fromEntries(value.variants.map(item=>[item.id,item.offeringId ?? ""])));}
      } catch (e) {if (alive) setError(messageFrom(e));}
      finally {if (alive) setLoading(false);}
    }
    void start();
    return () => {alive=false;};
  },[base,storeId]);
  async function save(payload:object, success:string) {
    if (!canEdit || busy) return;
    setBusy(true);setError("");setMessage("");
    try {await callMerchant(base,"POST",payload);await load();setMessage(success);}
    catch(e){setError(messageFrom(e));}
    finally {setBusy(false);}
  }
  if (loading) return <p role="status" className="text-sm text-zinc-600">Loading ways to sell…</p>;
  return <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Ways to sell">
    <div><h3 className="text-lg font-semibold">Ways to sell this product</h3>
      <p className="mt-1 text-sm text-zinc-600">Describe whether each edition is a download, original artwork, art print, or ordinary merchandise. The choices below classify existing SKUs; they do not change prices, fulfillment, inventory or published listings.</p></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {!data && <p className="text-sm text-zinc-600">Offerings could not be loaded. Change sections and return to retry.</p>}
    {data && <>
      <div className="space-y-3">
        {data.offerings.map(offering => {
          const draft = edits[offering.id] ?? {kind:offering.kind,name:offering.name};
          const attached = data.variants.filter(v=>v.offeringId===offering.id);
          const kindAllowed = options.filter(kind=>attached.every(v=>compatible(kind,v.fulfillment)));
          return <article key={offering.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">{offering.name}</strong>
              <span className="text-xs text-zinc-500">{attached.length} edition{attached.length === 1 ? "" : "s"} · {offering.status.toLowerCase()} (classification)</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-sm font-medium">Offering name<input className={field} maxLength={100} disabled={!canEdit || busy} value={draft.name} onChange={e=>setEdits(old=>({...old,[offering.id]:{...draft,name:e.target.value}}))}/></label>
              <label className="text-sm font-medium">Type<select className={field} disabled={!canEdit || busy} value={draft.kind} onChange={e=>setEdits(old=>({...old,[offering.id]:{...draft,kind:e.target.value as Kind}}))}>
                {kindAllowed.map(kind=><option key={kind} value={kind}>{kindLabels[kind]}</option>)}
              </select></label>
              <button type="button" className={secondary} disabled={!canEdit || busy || draft.name.trim().length<2 || (draft.name===offering.name && draft.kind===offering.kind)} onClick={()=>void save({action:"update",offeringId:offering.id,kind:draft.kind,name:draft.name},"Offering updated")}>Save</button>
            </div>
            {!!attached.length && <p className="mt-3 text-xs text-zinc-500">Contains: {attached.map(v=>v.name).join(", ")}</p>}
          </article>;
        })}
      </div>
      {canEdit && <form className="rounded-xl border border-dashed border-zinc-300 p-4" onSubmit={e=>{e.preventDefault();void save({action:"create",kind:newKind,name:newName},"New offering created. Assign editions below.");}}>
        <h4 className="font-semibold">Add another way to sell</h4>
        <p className="mt-1 text-xs text-zinc-600">For example, keep your one-of-a-kind canvas separate from the print reproductions. A new offering starts without editions.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium">Type<select className={field} value={newKind} disabled={busy} onChange={e=>{const kind=e.target.value as Kind;setNewKind(kind);setNewName(kindLabels[kind]);}}>{options.map(kind=><option key={kind} value={kind}>{kindLabels[kind]}</option>)}</select></label>
          <label className="text-sm font-medium">Name<input className={field} value={newName} maxLength={100} disabled={busy} onChange={e=>setNewName(e.target.value)}/></label>
          <button className={primary} disabled={busy || newName.trim().length<2 || data.offerings.some(o=>o.kind===newKind)}>Add offering</button>
        </div>
        {data.offerings.some(o=>o.kind===newKind) && <p className="mt-2 text-xs text-amber-800">You already offer this type. Edit the existing one above.</p>}
      </form>}
      <div className="border-t border-zinc-200 pt-5">
        <h4 className="font-semibold">Assign existing editions</h4>
        <p className="mt-1 text-sm text-zinc-600">Choose which offering each existing SKU belongs to. Digital editions can only go under Download; physical editions can go under Original, Print, or Merchandise.</p>
        <div className="mt-4 space-y-2">{data.variants.map(variant=>{
          const allowed = data.offerings.filter(offering=>compatible(offering.kind,variant.fulfillment));
          const choice = assignments[variant.id] ?? "";
          return <div key={variant.id} className="grid items-center gap-2 rounded-xl bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <div><p className="text-sm font-semibold">{variant.name}</p><p className="text-xs text-zinc-600">{variant.fulfillment === "DIGITAL" ? "Digital" : "Physical"} · {variant.active ? "Active" : "Inactive"}</p></div>
            <label className="text-xs font-medium">Belongs to<select className={field} disabled={!canEdit || busy || !allowed.length} value={choice} onChange={e=>setAssignments(old=>({...old,[variant.id]:e.target.value}))}>
              <option value="">Unassigned</option>{allowed.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select></label>
            <button type="button" className={secondary} disabled={!canEdit || busy || !choice || choice===variant.offeringId} onClick={()=>void save({action:"assign",variantId:variant.id,offeringId:choice},"Edition assigned")}>Apply</button>
          </div>;
        })}</div>
      </div>
    </>}
    <p className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">Coming next: reusable option groups (size, color, coffee grind, frame) and guided first-time product creation. This screen does not activate promotions, bundles, or checkout changes.</p>
  </section>;
}
