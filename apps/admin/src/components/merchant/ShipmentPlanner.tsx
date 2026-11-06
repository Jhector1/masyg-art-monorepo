"use client";
import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { callMerchant, primary, field } from "./shared";
type Item = { id:string; titleSnapshot:string; quantity:number; fulfillment:string };
export default function ShipmentPlanner({ organizationId,storeId,orderId,status,items }: {
  organizationId:string;storeId:string;orderId:string;status:string;items:Item[];
}) {
  const router=useRouter();const [amounts,setAmounts]=useState<Record<string,number>>({});const [carrier,setCarrier]=useState("");
  const [tracking,setTracking]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const requestId=useRef<string|null>(null);
  const physical=items.filter(i=>i.fulfillment==="PHYSICAL");
  const enabled=(status==="PAID"||status==="FULFILLING")&&physical.length>0;
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!enabled||busy)return;
    const selected=physical.map(i=>({orderItemId:i.id,quantity:amounts[i.id]||0})).filter(i=>i.quantity>0);
    if(!selected.length)return;
    if(!window.confirm("Create a PENDING shipment plan? This will NOT mark the order shipped, charge, refund, or adjust stock."))return;
    if(!requestId.current) requestId.current=crypto.randomUUID();
    setBusy(true);setError("");setMessage("");
    try {await callMerchant(`/api/merchant/organizations/${organizationId}/stores/${storeId}/orders/${orderId}/shipment-plans`,"POST",{
      clientRequestId:requestId.current,items:selected,carrier:carrier.trim(),trackingNumber:tracking.trim() });
      requestId.current=null;setAmounts({});setMessage("Pending shipment plan recorded. Shipping confirmation is not yet enabled.");router.refresh();}
    catch(err){setError(err instanceof Error?err.message:"Could not plan shipment");}
    finally{setBusy(false);}
  }
  return <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Plan physical shipment</h2>
    <p className="mt-1 text-xs text-zinc-500">Planning only. Does not confirm dispatch, consume inventory, or alter the payment/order status. Quantities across plans cannot exceed the purchased physical units.</p>
    {error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{message&&<p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    {enabled ? <form onSubmit={e=>void submit(e)} className="mt-4 space-y-3">
      {physical.map(item=><label key={item.id} className="flex items-center justify-between gap-3 text-sm"><span>{item.titleSnapshot} (ordered {item.quantity})</span>
        <input type="number" min={0} max={item.quantity} step={1} className="w-24 rounded-lg border p-2" value={amounts[item.id]||0}
          onChange={e=>{setAmounts({...amounts,[item.id]:Math.max(0,Math.min(item.quantity,Number(e.target.value)||0))});requestId.current=null;}}/></label>)}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Carrier (optional)<input className={field} maxLength={80} value={carrier} onChange={e=>{setCarrier(e.target.value);requestId.current=null;}}/></label>
        <label className="text-sm">Tracking reference (optional)<input className={field} maxLength={120} value={tracking} onChange={e=>{setTracking(e.target.value);requestId.current=null;}}/></label></div>
      <button className={primary} disabled={busy||Object.values(amounts).every(v=>v<=0)}>{busy?"Saving…":"Create pending shipment plan"}</button></form>
      : <p className="mt-3 text-sm text-zinc-500">Available only for paid orders containing physical items.</p>}
  </section>;
}
