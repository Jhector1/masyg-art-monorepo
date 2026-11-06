"use client";
import * as React from "react";
import Link from "next/link";
import {getCurrentStorefront,listStoreOrders,type BuyerOrder} from "@acme/core/lib/client/storefront-commerce";
const money=(minor:number,currency:string)=>new Intl.NumberFormat(undefined,{style:"currency",currency}).format(minor/100);
const date=(iso:string)=>new Date(iso).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
export default function OrdersPage(){
  const [orders,setOrders]=React.useState<BuyerOrder[]>([]);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState<string|null>(null);
  React.useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const {store}=await getCurrentStorefront();
        const result=await listStoreOrders(store.id);
        if(active)setOrders(result.orders);
      }catch(err){if(active)setError(err instanceof Error?err.message:"Unable to load orders");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false};
  },[]);
  return <main className="mx-auto w-full max-w-5xl p-4 md:p-8">
    <div className="flex items-end justify-between gap-3"><div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">My Orders</h1>
      <p className="mt-1 text-sm text-neutral-600">Orders associated with your account in this shop.</p>
    </div><Link href="/store" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">Continue shopping</Link></div>
    {loading && <p className="mt-6 text-neutral-600">Loading orders…</p>}
    {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!loading&&!error&&orders.length===0&&<p className="mt-6 rounded-2xl border p-6 text-sm text-neutral-700">No orders yet.</p>}
    {!loading&&!error&&<div className="mt-6 space-y-4">{orders.map(order=><Link key={order.id} href={`/account/orders/${encodeURIComponent(order.id)}`}
       className="block rounded-2xl border border-neutral-200 bg-white p-5 transition hover:shadow-md">
       <div className="flex flex-wrap items-center justify-between gap-3"><div>
         <div className="text-sm font-medium text-neutral-900">Order #{order.id.slice(0,8)}</div>
         <div className="mt-1 text-xs text-neutral-500">{date(order.createdAt)} · {order.items.length} item(s) · {order.status}</div>
       </div><div className="font-semibold text-neutral-900">{money(order.totalMinor,order.currency)}</div></div>
       <div className="mt-3 text-sm text-neutral-600">{order.items.map(i=>i.titleSnapshot).join(", ")}</div>
    </Link>)}</div>}
  </main>;
}
