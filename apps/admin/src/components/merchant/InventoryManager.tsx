"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { callMerchant, field, mutatable, primary, secondary } from "./shared";

type Location = { id: string; name: string };
type Level = { locationId: string; onHand: number; reserved: number };
type InventoryProduct = { id: string; title: string; variants: { id: string; name: string; sku: string | null;
  inventoryPolicy: "TRACKED" | "UNLIMITED"; inventory: Level[] }[] };
type Snapshot = { locations: Location[]; products: InventoryProduct[]; cappedAt: number };
export default function InventoryManager({ store, snapshot }: { store: StoreChoice; snapshot: Snapshot }) {
  const router = useRouter(); const canEdit = mutatable(store);
  const [locationName, setLocationName] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const root = `/api/merchant/organizations/${store.organizationId}/inventory`;
  async function run(work: () => Promise<unknown>, success: string) {
    if (!canEdit || busy) return false; setBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(success); router.refresh(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Inventory change failed"); return false; }
    finally { setBusy(false); }
  }
  async function addLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (await run(() => callMerchant(`${root}/locations`, "POST", { name: locationName }), "Stock location added")) setLocationName("");
  }
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Stock locations</h2>
      <p className="mt-1 text-xs text-zinc-500">Locations are organization-wide. Stock changes never modify reserved quantities and are audit-logged.</p>
      <div className="mt-3 flex flex-wrap gap-2">{snapshot.locations.map(l => <span key={l.id} className="rounded-full border bg-zinc-50 px-3 py-1 text-xs font-medium">{l.name}</span>)}{!snapshot.locations.length && <span className="text-sm text-zinc-500">Add a stock location to begin.</span>}</div>
      {canEdit && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => void addLocation(e)}><label className="w-full max-w-sm text-sm font-medium">New location<input className={field} maxLength={100} value={locationName} placeholder="Studio · Warehouse · Art gallery" onChange={e => setLocationName(e.target.value)} /></label><button className={secondary} disabled={busy || !locationName.trim()}>Add location</button></form>}
    </section>
    <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Physical variants</h2>
      <p className="text-xs text-zinc-500">Showing up to {snapshot.cappedAt} listings for the selected storefront. Increase stock for a new print run or subtract stock for verified physical adjustments. This does not process orders.</p>
      {snapshot.products.map(p => <div key={p.id} className="space-y-2"><h3 className="font-semibold">{p.title}</h3>{p.variants.map(v => <StockRow key={v.id} variant={v} locations={snapshot.locations} canEdit={canEdit} busy={busy} adjust={(locationId, delta, reason) => run(() => callMerchant(`${root}/adjustments`, "POST", {
        storeId: store.storeId, variantId: v.id, locationId, delta, reason,
      }), "Stock adjustment recorded")}/>)}</div>)}
      {!snapshot.products.length && <p className="text-sm text-zinc-500">No physical variants in this storefront yet.</p>}
    </section>
  </div>;
}
function StockRow({ variant, locations, canEdit, busy, adjust }: {
  variant: InventoryProduct["variants"][number]; locations: Location[]; canEdit: boolean; busy: boolean;
  adjust: (id: string, delta: number, reason: string) => void;
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [deltaInput, setDeltaInput] = useState("1"); const [reason, setReason] = useState("");
  const activeLocationId = locationId || locations[0]?.id || "";
  const level = variant.inventory.find(l => l.locationId === activeLocationId);
  const count = Number(deltaInput); const valid = /^-?(?:[1-9]\d*)$/.test(deltaInput) && Number.isSafeInteger(count) && Math.abs(count) <= 100000;
  return <div className="rounded-xl border bg-zinc-50 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-semibold">{variant.name}</p><p className="text-xs text-zinc-500">SKU {variant.sku || "—"} · {variant.inventoryPolicy}</p></div><div className="text-right text-xs"><p>On hand <strong>{variant.inventory.reduce((n,l) => n + l.onHand,0)}</strong></p><p>Reserved <strong>{variant.inventory.reduce((n,l) => n + l.reserved,0)}</strong></p></div></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium">Location<select className={field} value={activeLocationId} onChange={e => setLocationId(e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><div className="self-end text-xs text-zinc-600">On hand: {level?.onHand ?? 0}<p>Reserved: {level?.reserved ?? 0}</p><p>Available: {(level?.onHand ?? 0) - (level?.reserved ?? 0)}</p></div></div>
      {canEdit && <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_auto]"><label className="text-xs font-medium">Stock change (+ / −)<input className={field} inputMode="numeric" value={deltaInput} onChange={e => setDeltaInput(e.target.value)}/></label><label className="text-xs font-medium">Reason<input className={field} value={reason} maxLength={200} placeholder="New shipment, damaged stock…" onChange={e => setReason(e.target.value)}/></label><button className={`${primary} self-end`} disabled={busy || !activeLocationId || !valid || reason.trim().length < 3 || variant.inventoryPolicy !== "TRACKED"} onClick={() => { if (window.confirm(`Adjust ${variant.name} stock by ${count > 0 ? "+" : ""}${count} at this location?`)) adjust(activeLocationId, count, reason.trim()); }}>Record change</button></div>}
      {variant.inventoryPolicy !== "TRACKED" && <p className="mt-2 text-xs text-amber-700">Unlimited inventory variant: stock adjustments are unavailable.</p>}
    </div>;
}
