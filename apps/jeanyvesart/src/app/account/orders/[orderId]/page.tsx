"use client";
import * as React from "react";
import Link from "next/link";
import {getCurrentStorefront,getStoreOrder,type BuyerOrder} from "@acme/core/lib/client/storefront-commerce";
const money=(minor:number,currency:string)=>new Intl.NumberFormat(undefined,{style:"currency",currency}).format(minor/100);
export default function OrderDetailPage({params}:{params:Promise<{orderId:string}>}){
  const {orderId}=React.use(params);
  const [order,setOrder]=React.useState<BuyerOrder|null>(null);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState<string|null>(null);
  React.useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const {store}=await getCurrentStorefront();
        const response=await getStoreOrder(store.id,orderId);
        if(active)setOrder(response.order);
      }catch(err){if(active)setError(err instanceof Error?err.message:"Unable to load order");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false};
  },[orderId]);
  return <main className="mx-auto w-full max-w-5xl p-4 md:p-8">
    <Link href="/account/orders" className="text-sm text-neutral-600 hover:text-neutral-900">← Back to orders</Link>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Order details</h1>
    {loading&&<p className="mt-6 text-neutral-600">Loading order…</p>}
    {error&&<p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!loading&&!error&&order&&<div className="mt-6 grid gap-4 md:grid-cols-3">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="font-semibold text-neutral-900">#{order.id.slice(0,8)}</div>
        <div className="mt-2 text-sm text-neutral-700">Status: {order.status}</div>
        <div className="mt-2 text-sm text-neutral-700">Placed: {new Date(order.createdAt).toLocaleString()}</div>
        <div className="mt-3 font-semibold">Total: {money(order.totalMinor,order.currency)}</div>
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 md:col-span-2">
        <h2 className="font-semibold text-neutral-900">Items</h2>
        <div className="mt-3 space-y-3">{order.items.map(item=><div key={item.id} className="rounded-xl border border-neutral-200 p-3">
          <div className="flex justify-between gap-3"><span className="font-medium">{item.titleSnapshot}</span>
            <span>{money(item.totalMinor,order.currency)}</span></div>
          <div className="mt-1 text-xs text-neutral-500">{item.fulfillment} · Quantity: {item.quantity}</div>
        </div>)}</div>
      </section>
    </div>}
  </main>;
}
