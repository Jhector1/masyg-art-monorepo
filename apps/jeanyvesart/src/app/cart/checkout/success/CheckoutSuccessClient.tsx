"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentStorefront } from "@acme/core/lib/client/storefront-commerce";

type OrderStatus = {
  id: string;
  status: string;
  currency: string;
  totalMinor: number;
  placedAt: string;
  shipping: null | {label?: string | null;street:string;city:string;state:string;postalCode:string;country:string};
  items: Array<{id:string;title:string;type:"PHYSICAL"|"DIGITAL";priceMinor:number;quantity:number}>;
  processing: boolean;
};

function money(minor:number,currency:string) {
  const fmt=new Intl.NumberFormat(undefined,{style:"currency",currency});
  const digits=fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(minor / (10 ** digits));
}

export default function CheckoutSuccessClient() {
  const params=useSearchParams();
  const sessionId=params.get("session_id") || "";
  const [data,setData]=React.useState<OrderStatus|null>(null);
  const [err,setErr]=React.useState<string|null>(null);
  const [loading,setLoading]=React.useState(true);

  const fetchOrder=React.useCallback(async()=>{
    if (!sessionId) throw new Error("Missing checkout session");
    // The verified domain selects the merchant; the browser never chooses another organization.
    const ctx=await getCurrentStorefront();
    const path=`/api/public/stores/${encodeURIComponent(ctx.store.id)}/orders/by-session?session_id=${encodeURIComponent(sessionId)}`;
    const response=await fetch(path,{credentials:"same-origin",cache:"no-store"});
    const body=await response.json().catch(()=>null);
    if (!response.ok) throw new Error(response.status===401 ? "Sign in to view this order" : body?.error || "Checkout status unavailable");
    return body as OrderStatus;
  },[sessionId]);

  React.useEffect(()=>{
    let alive=true;
    (async()=>{
      try { setLoading(true);setErr(null);const order=await fetchOrder();if(alive)setData(order); }
      catch(e) { if(alive)setErr(e instanceof Error?e.message:"Checkout status unavailable"); }
      finally { if(alive)setLoading(false); }
    })();
    return ()=>{alive=false};
  },[fetchOrder]);

  React.useEffect(()=>{
    if (!data?.processing)return;
    let cancelled=false;
    const timer=setInterval(async()=>{
      try {const order=await fetchOrder();if(!cancelled){setData(order);setErr(null)}}
      catch { /* Transient network issues must not imply payment completion. */ }
    },3000);
    return ()=>{cancelled=true;clearInterval(timer)};
  },[data?.processing,fetchOrder]);

  const settled=data && ["PAID","FULFILLING","FULFILLED"].includes(data.status);
  return (
    <main className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-neutral-900">
        {settled?"Payment confirmed":"Checkout status"}
      </h1>
      {loading && <p className="mt-4 text-sm text-neutral-600">Loading your order…</p>}
      {err && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {data && <>
        <p className="mt-3 text-sm text-neutral-700">
          {data.processing?"Your payment is still being verified. This page will refresh automatically.":
           settled?"Your payment was confirmed by the store.":
           "Your order is not currently marked as paid."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-neutral-800">
          <span>Order <strong>{data.id}</strong></span>
          <span>Status <strong>{data.status}</strong></span>
          <span>Total <strong>{money(data.totalMinor,data.currency)}</strong></span>
        </div>
        <h2 className="mt-6 text-sm font-semibold text-neutral-900">Order items</h2>
        <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
          {data.items.map(item=><li key={item.id} className="flex items-start justify-between gap-4 p-3 text-sm">
            <div><p className="font-medium text-neutral-900">{item.title}</p><p className="text-neutral-500">{item.type==="DIGITAL"?"Digital artwork":"Physical artwork"} · Qty {item.quantity}</p></div>
            <span className="font-medium text-neutral-900">{money(item.priceMinor,data.currency)}</span>
          </li>)}
        </ul>
        {data.shipping && <section className="mt-6 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-800">
          <h2 className="font-semibold">Shipping address</h2>
          <p className="mt-2">{data.shipping.street}</p>
          <p>{data.shipping.city}, {data.shipping.state} {data.shipping.postalCode}</p>
          <p>{data.shipping.country}</p>
        </section>}
        {data.items.some(item=>item.type==="DIGITAL") && <p className="mt-5 text-sm text-neutral-600">
          Digital files are available only after payment settlement and entitlement verification. No download access is issued by this page.
        </p>}
      </>}
    </main>
  );
}
