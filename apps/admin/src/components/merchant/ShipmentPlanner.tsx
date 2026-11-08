"use client";

import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { callMerchant, primary, field } from "./shared";

type Item = { id: string; titleSnapshot: string; quantity: number; fulfillment: string };
export default function ShipmentPlanner({ organizationId, storeId, orderId, status, items }: {
  organizationId: string; storeId: string; orderId: string; status: string; items: Item[];
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const physical = items.filter(item => item.fulfillment === "PHYSICAL");
  const enabled = (status === "PAID" || status === "FULFILLING") && physical.length > 0;
  const selectedCount = physical.reduce((sum, item) => sum + (amounts[item.id] || 0), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || busy) return;
    const selected = physical.map(item => ({ orderItemId: item.id, quantity: amounts[item.id] || 0 })).filter(item => item.quantity > 0);
    if (!selected.length) return;
    if (!window.confirm("Create a PENDING shipment plan? This does NOT mark the order shipped, charge, refund, or adjust stock.")) return;
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setBusy(true); setError(""); setMessage("");
    try {
      await callMerchant(`/api/merchant/organizations/${organizationId}/stores/${storeId}/orders/${orderId}/shipment-plans`, "POST", {
        clientRequestId: requestId.current, items: selected, carrier: carrier.trim(), trackingNumber: tracking.trim(),
      });
      requestId.current = null; setAmounts({}); setCarrier(""); setTracking("");
      setMessage("Pending shipment plan recorded. Shipping confirmation is not enabled from this screen.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not plan shipment"); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="shipment-plan-heading" className="rounded-2xl border bg-white p-5">
    <h3 id="shipment-plan-heading" className="text-lg font-semibold">Create a pending shipment plan</h3>
    <p className="mt-2 text-sm text-zinc-600">Select the physical items to include, optionally add a carrier or tracking reference, and review before saving. This creates a plan only; it does not ship an order, reserve or consume stock, or change a payment.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {enabled ? <form onSubmit={e => void submit(e)} className="mt-4 space-y-4">
      <fieldset className="space-y-3"><legend className="font-semibold">1. How many units are in this plan?</legend>
        {physical.map(item => <label key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-zinc-50 p-3 text-sm"><span><strong>{item.titleSnapshot}</strong><span className="mt-1 block text-xs text-zinc-500">Purchased quantity: {item.quantity}</span></span>
          <span className="text-xs font-semibold">Units to plan <input type="number" min={0} max={item.quantity} step={1} className="mt-1 block w-24 rounded-lg border p-2 text-sm" value={amounts[item.id] || 0} onChange={e => {
            setAmounts({ ...amounts, [item.id]: Math.max(0, Math.min(item.quantity, Math.trunc(Number(e.target.value) || 0))) }); requestId.current = null;
          }} /></span></label>)}
        <p className="text-xs text-zinc-500">The server checks the remaining unplanned quantity across existing plans before accepting a new plan.</p>
      </fieldset>
      <fieldset className="space-y-3"><legend className="font-semibold">2. Optional shipping details</legend>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Carrier<input className={field} maxLength={80} value={carrier} placeholder="Carrier name" onChange={e => { setCarrier(e.target.value); requestId.current = null; }}/></label>
          <label className="text-sm">Tracking reference<input className={field} maxLength={120} value={tracking} placeholder="Leave blank if not assigned" onChange={e => { setTracking(e.target.value); requestId.current = null; }}/></label></div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-zinc-50 p-4"><div><p className="text-sm font-semibold">3. Review and save</p><p className="text-xs text-zinc-500">{selectedCount} unit(s) selected · Result: PENDING shipment plan</p></div>
        <button type="submit" className={primary} disabled={busy || selectedCount <= 0}>{busy ? "Saving…" : "Create pending plan"}</button></div>
    </form> : <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">{physical.length === 0 ? "This order contains no physical items, so no shipment plan is needed." : "Pending shipment plans are available only for paid orders in eligible fulfillment states."}</p>}
  </section>;
}
