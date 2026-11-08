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
type InventoryRoom = "locations" | "stock";

export default function InventoryManager({ store, snapshot }: { store: StoreChoice; snapshot: Snapshot }) {
  const router = useRouter();
  const canEdit = mutatable(store);
  const [room, setRoom] = useState<InventoryRoom>(snapshot.locations.length ? "stock" : "locations");
  const [locationName, setLocationName] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const root = `/api/merchant/organizations/${store.organizationId}/inventory`;
  const products = snapshot.products.filter(p => p.variants.length > 0);
  const variants = products.flatMap(p => p.variants);
  const searchableVariants = products.flatMap(product => product.variants.map(variant => ({ product, variant })));
  const matches = searchableVariants.filter(({ product, variant }) =>
    `${product.title} ${variant.name} ${variant.sku || ""}`.toLowerCase().includes(productSearch.trim().toLowerCase()));
  const selected = matches.find(({ variant }) => variant.id === selectedVariantId)
    ?? matches.find(({ variant }) => variant.inventoryPolicy === "TRACKED")
    ?? matches[0];
  const tracked = variants.filter(v => v.inventoryPolicy === "TRACKED");
  const totalAvailable = tracked.reduce((sum, variant) => sum + variant.inventory.reduce((n, level) => n + level.onHand - level.reserved, 0), 0);

  async function run(work: () => Promise<unknown>, success: string) {
    if (!canEdit || busy) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      await work();
      setMessage(success);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inventory change failed");
      return false;
    } finally { setBusy(false); }
  }
  async function addLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await run(() => callMerchant(`${root}/locations`, "POST", { name: locationName.trim() }), "Stock location added")) setLocationName("");
  }

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Inventory summary">
      <SummaryStat title="Stock locations" value={snapshot.locations.length} detail="Shared across your organization" />
      <SummaryStat title="Tracked physical variants" value={tracked.length} detail="In this storefront's catalog" />
      <SummaryStat title="Available units" value={totalAvailable} detail="On hand minus reserved, tracked variants" />
    </div>

    <div className="grid gap-3 sm:grid-cols-2" aria-label="Inventory tasks">
      <RoomButton active={room === "locations"} number="1" title="Stock locations" description="See where your stock is stored or create a new location" onClick={() => { setRoom("locations"); setError(""); setMessage(""); }} />
      <RoomButton active={room === "stock"} number="2" title="Adjust stock" description="Record stock received, lost, damaged, or corrected" onClick={() => { setRoom("stock"); setError(""); setMessage(""); }} />
    </div>

    {!canEdit && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your account can view inventory but cannot change stock. An authorized store manager can add locations and record adjustments.</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

    {room === "locations" && <section aria-labelledby="inventory-locations-heading" className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 1 of 2</p><h2 id="inventory-locations-heading" className="mt-1 text-xl font-semibold">Where do you keep your stock?</h2>
        <p className="mt-1 text-sm text-zinc-600">A location can be your studio, gallery, warehouse, or another place where items are stored. Locations are shared across stores in the same organization.</p></div>
      <div className="flex flex-wrap gap-2">{snapshot.locations.map(location => <span key={location.id} className="rounded-full border bg-zinc-50 px-3 py-2 text-sm font-medium">{location.name}</span>)}
        {!snapshot.locations.length && <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No stock locations yet. Add one to record tracked physical inventory.</p>}</div>
      {canEdit && <form className="flex flex-wrap items-end gap-3" onSubmit={e => void addLocation(e)}>
        <label className="w-full max-w-sm text-sm font-semibold">Location name
          <input className={field} maxLength={100} value={locationName} placeholder="Studio, Warehouse, Gallery…" onChange={e => setLocationName(e.target.value)} />
        </label><button className={secondary} disabled={busy || !locationName.trim()}>{busy ? "Saving…" : "Add location"}</button>
      </form>}
      <div className="border-t pt-4"><button type="button" className={primary} onClick={() => { setRoom("stock"); setError(""); setMessage(""); }}>Continue to stock adjustments →</button></div>
    </section>}

    {room === "stock" && <section aria-labelledby="inventory-stock-heading" className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 2 of 2</p><h2 id="inventory-stock-heading" className="mt-1 text-xl font-semibold">Record a stock change</h2>
        <p className="mt-1 text-sm text-zinc-600">Select a physical product, choose a location, and enter how many units to add or remove. Adjustments are recorded in the audit log; they do not process orders or change reservations.</p></div>
      {!snapshot.locations.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Create a stock location first. <button type="button" className="font-semibold underline" onClick={() => setRoom("locations")}>Go to stock locations</button>.</div>}
      {searchableVariants.length > 0 && <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Find a product or SKU
            <input type="search" className={field} value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search product, edition or SKU" />
          </label>
          <label className="text-sm font-semibold">Choose an edition to adjust
            <select className={field} value={selected?.variant.id ?? ""} disabled={!matches.length} onChange={e => setSelectedVariantId(e.target.value)}>
              {!matches.length && <option value="">No matching editions</option>}
              {matches.map(({ product, variant }) => <option key={variant.id} value={variant.id}>{product.title} — {variant.name}{variant.sku ? ` (${variant.sku})` : ""}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-zinc-500">{matches.length} of {searchableVariants.length} editions match. Change the selection to adjust a different edition. Only one stock form is shown at a time.</p>
      </div>}
      {selected && <div className="space-y-3"><h3 className="text-base font-semibold">{selected.product.title}</h3>
        <StockRow key={`${store.storeId}:${selected.variant.id}`} variant={selected.variant} locations={snapshot.locations} canEdit={canEdit} busy={busy}
          adjust={(locationId, delta, reason) => run(() => callMerchant(`${root}/adjustments`, "POST", {
            storeId: store.storeId, variantId: selected.variant.id, locationId, delta, reason,
          }), "Stock adjustment recorded")}/></div>}
      {products.length > 0 && matches.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-zinc-600">No editions match that search. Try the product title, edition name, or SKU.</p>}
      {!products.length && <p className="rounded-xl bg-zinc-50 p-5 text-sm text-zinc-600">No physical product variants are listed in this storefront yet. Add a physical product in the Products room to start tracking its stock.</p>}
      <p className="border-t pt-4 text-xs text-zinc-500">Showing up to {snapshot.cappedAt} catalog listings for this storefront. Inventory totals include only the variants shown; unlimited-inventory variants are not counted as available units.</p>
    </section>}
  </div>;
}

function SummaryStat({ title, value, detail }: { title: string; value: number; detail: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-zinc-500">{title}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></div>;
}
function RoomButton({ active, number, title, description, onClick }: { active: boolean; number: string; title: string; description: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"}`}>
    <div className="flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${active ? "bg-white/15" : "bg-amber-50 text-amber-800"}`}>{number}</span><span className="font-semibold">{title}</span></div>
    <p className={`mt-2 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>{description}</p>
  </button>;
}

function StockRow({ variant, locations, canEdit, busy, adjust }: {
  variant: InventoryProduct["variants"][number]; locations: Location[]; canEdit: boolean; busy: boolean;
  adjust: (id: string, delta: number, reason: string) => Promise<boolean>;
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantityInput, setQuantityInput] = useState("1");
  const [reason, setReason] = useState("");
  const activeLocationId = locations.some(l => l.id === locationId) ? locationId : (locations[0]?.id ?? "");
  const activeLocation = locations.find(l => l.id === activeLocationId);
  const level = variant.inventory.find(l => l.locationId === activeLocationId);
  const totalOnHand = variant.inventory.reduce((sum, l) => sum + l.onHand, 0);
  const totalReserved = variant.inventory.reduce((sum, l) => sum + l.reserved, 0);
  const available = (level?.onHand ?? 0) - (level?.reserved ?? 0);
  const quantity = Number(quantityInput);
  const quantityValid = /^(?:[1-9]\d*)$/.test(quantityInput) && Number.isSafeInteger(quantity) && quantity <= 100000;
  const tracked = variant.inventoryPolicy === "TRACKED";
  const removable = direction === "add" || (quantityValid && quantity <= available);
  const canSubmit = canEdit && tracked && !!activeLocationId && !busy && quantityValid && removable && reason.trim().length >= 3;
  type StockReview = { locationId: string; locationName: string; direction: "add" | "remove"; quantity: number; reason: string;
    onHandBefore: number; reserved: number; availableBefore: number; onHandAfter: number; availableAfter: number };
  const [review, setReview] = useState<StockReview | null>(null);
  function resetReview() { setReview(null); }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || review) return;
    const delta = direction === "add" ? quantity : -quantity;
    const onHandBefore = level?.onHand ?? 0;
    const reserved = level?.reserved ?? 0;
    setReview({ locationId: activeLocationId, locationName: activeLocation?.name ?? "Location", direction, quantity,
      reason: reason.trim(), onHandBefore, reserved, availableBefore: available,
      onHandAfter: onHandBefore + delta, availableAfter: available + delta });
  }
  async function confirmAdjustment() {
    if (!review || !canEdit || busy || !tracked) return;
    // The server is authoritative: it rechecks stock availability and permissions when saving.
    if (review.direction === "remove" && review.availableAfter < 0) return;
    const delta = review.direction === "add" ? review.quantity : -review.quantity;
    const saved = await adjust(review.locationId, delta, review.reason);
    if (saved) { setReason(""); setQuantityInput("1"); setReview(null); }
  }

  return <div className="rounded-xl border bg-zinc-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">{variant.name}</h4><p className="mt-1 text-xs text-zinc-500">SKU {variant.sku || "Not set"} · {tracked ? "Stock tracked" : "Unlimited stock"}</p></div>
      <div className="text-right text-xs text-zinc-600"><p>On hand <strong className="tabular-nums">{totalOnHand}</strong></p><p>Reserved <strong className="tabular-nums">{totalReserved}</strong></p><p>Available <strong className="tabular-nums">{tracked ? totalOnHand - totalReserved : "Not tracked"}</strong></p></div></div>
    {tracked && <div className="mt-4 space-y-3">
      <label className="block max-w-sm text-xs font-semibold">Location
        <select className={field} value={activeLocationId} onChange={e => { setLocationId(e.target.value); resetReview(); }} disabled={!locations.length || busy || !!review}>
          {!locations.length && <option value="">Create a location first</option>}
          {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
      </label>
      {!!activeLocationId && <p className="text-xs text-zinc-600">At this location: {level?.onHand ?? 0} on hand · {level?.reserved ?? 0} reserved · <strong>{available} available</strong></p>}
      {canEdit && <form onSubmit={e => void submit(e)} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap gap-2" aria-label="Stock adjustment type">
          {(["add", "remove"] as const).map(value => <button key={value} type="button" aria-pressed={direction === value} disabled={busy || !!review} onClick={() => { setDirection(value); resetReview(); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${direction === value ? "bg-zinc-900 text-white" : "border bg-white text-zinc-700"}`}>{value === "add" ? "+ Add units" : "− Remove units"}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(110px,160px)_1fr_auto] sm:items-end"><label className="text-xs font-semibold">Quantity
          <input className={field} inputMode="numeric"  value={quantityInput} disabled={busy || !!review} onChange={e => { setQuantityInput(e.target.value); resetReview(); }} placeholder="1" />
        </label><label className="text-xs font-semibold">Why is stock changing?
          <input className={field} value={reason} maxLength={200} disabled={busy || !!review} placeholder="Restock, damaged item, stock count…" onChange={e => { setReason(e.target.value); resetReview(); }}/>
        </label><button type="submit" className={primary} disabled={!canSubmit || !!review}>{busy ? "Saving…" : "Review stock change"}</button></div>
        {quantityInput && !quantityValid && <p className="text-xs text-rose-700">Enter a whole number from 1 to 100,000.</p>}
        {direction === "remove" && quantityValid && !removable && <p className="text-xs text-rose-700">Only {available} unreserved unit(s) can be removed from this location. Reserved units must remain available.</p>}
        <p className="text-xs text-zinc-500">Review the projected on-hand and available quantities before confirming. The server checks reserved stock and permissions again.</p>
        {review && <section aria-labelledby="stock-review-title" className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <h5 id="stock-review-title" className="text-base font-bold text-zinc-950">Confirm stock adjustment</h5>
          <p className="text-sm text-zinc-800"><strong>{review.direction === "add" ? "Add" : "Remove"} {review.quantity} unit(s)</strong> {review.direction === "add" ? "to" : "from"} {variant.name} at {review.locationName}.</p>
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-white p-3 text-sm sm:grid-cols-4">
            <div><dt className="text-zinc-500">On hand now</dt><dd className="font-semibold tabular-nums">{review.onHandBefore}</dd></div>
            <div><dt className="text-zinc-500">On hand after</dt><dd className="font-semibold tabular-nums">{review.onHandAfter}</dd></div>
            <div><dt className="text-zinc-500">Available now</dt><dd className="font-semibold tabular-nums">{review.availableBefore}</dd></div>
            <div><dt className="text-zinc-500">Available after</dt><dd className="font-semibold tabular-nums">{review.availableAfter}</dd></div>
          </dl>
          <p className="text-xs text-zinc-700">Reason: <strong>{review.reason}</strong> · Reserved units at this location: {review.reserved}. Orders and reservations are unchanged.</p>
          <p className="text-xs text-zinc-600">These are estimates from the currently displayed stock. The server may reject a change if stock has changed elsewhere.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} disabled={busy} onClick={resetReview}>Back to edit</button>
            <button type="button" className={primary} disabled={busy} onClick={() => void confirmAdjustment()}>{busy ? "Recording…" : "Confirm stock adjustment"}</button>
          </div>
        </section>}
      </form>}
    </div>}
    {!tracked && <p className="mt-3 text-xs text-amber-800">This variant has unlimited inventory. Stock adjustments are unavailable until its inventory policy is changed through the product's supported settings.</p>}
  </div>;
}
