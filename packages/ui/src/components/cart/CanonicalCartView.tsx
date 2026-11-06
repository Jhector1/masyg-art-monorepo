"use client";
import Link from "next/link";
import StripeTestCheckoutControl from "./StripeTestCheckoutControl";
import { useStoreCart } from "@acme/core/hooks/useStoreCart";
import { formatMinorMoney } from "@acme/core/lib/client/cart-view";

type Props = { theme: "ziledigital" | "jeanyvesart"; backHref: string; description: string };

/** Only presentation differs by brand; all cart reads and mutations use the canonical API. */
export default function CanonicalCartView({theme,backHref,description}:Props) {
  const {storeId,quote,loading,error,busyVariantId,reload,setQuantity} = useStoreCart();
  const art = theme === "jeanyvesart";
  const heading = art ? "text-neutral-950" : "text-green-800";
  const action = art ? "border-neutral-300 text-neutral-900" : "border-green-300 text-green-800";
  const money = (minor:number,currency:string) => formatMinorMoney(minor,currency);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className={`text-3xl font-semibold ${heading}`}>Your Cart</h1>
          <p className="mt-2 text-sm text-neutral-600">{description}</p></div>
        <Link href={backHref} className={`rounded-xl border px-4 py-2 text-sm ${action}`}>Continue shopping</Link>
      </header>
      {loading && <p role="status" className="mt-8 text-neutral-600">Loading your cart…</p>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        {error}<button type="button" className="ml-4 underline" onClick={()=>{void reload()}}>Retry</button></div>}
      {!loading && quote && <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-label="Cart items" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {quote.items.length === 0
            ? <p className="p-6 text-neutral-600">Your cart is empty.</p>
            : <ul className="divide-y divide-neutral-200">{quote.items.map(item => <li key={item.variantId} className="p-5">
              <div className="flex items-start justify-between gap-4"><div className="min-w-0">
                <h2 className="font-medium text-neutral-900">{item.title}</h2>
                <p className="mt-1 text-sm text-neutral-600">{item.variantName} · {item.fulfillment.toLowerCase()}</p>
                {item.selection && Object.keys(item.selection).length>0 && <p className="mt-1 text-xs text-neutral-500">
                  {Object.entries(item.selection).map(([key,value])=>`${key}: ${value}`).join(" · ")}
                </p>}
                {!item.available && <p className="mt-1 text-sm text-red-700">Currently unavailable</p>}
                <p className="mt-2 text-sm text-neutral-800">{money(item.unitPriceMinor,item.currency)} each</p>
              </div><strong className="whitespace-nowrap text-neutral-900">{money(item.lineMinor,item.currency)}</strong></div>
              <div className="mt-4 flex items-center gap-3">
                <button type="button" aria-label={`Decrease quantity of ${item.title}`} disabled={busyVariantId!==null}
                  onClick={()=>{void setQuantity(item.variantId,item.quantity-1)}} className="rounded-lg border px-3 py-1 disabled:opacity-40">−</button>
                <span aria-label="Quantity">{item.quantity}</span>
                <button type="button" aria-label={`Increase quantity of ${item.title}`} disabled={busyVariantId!==null || item.quantity>=20}
                  onClick={()=>{void setQuantity(item.variantId,item.quantity+1)}} className="rounded-lg border px-3 py-1 disabled:opacity-40">+</button>
                <button type="button" disabled={busyVariantId!==null} onClick={()=>{void setQuantity(item.variantId,0)}}
                  className="ml-3 text-sm text-red-700 underline disabled:opacity-40">Remove</button>
              </div>
            </li>)}</ul>}
        </section>
        <aside className="self-start rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <h2 className="text-lg font-semibold text-neutral-950">Cart summary</h2>
          <div className="mt-4 flex justify-between gap-3 text-sm"><span>Subtotal</span><strong>
            {quote.currency ? money(quote.subtotalMinor,quote.currency) : "—"}</strong></div>
          {quote.issues.length>0 && <p role="alert" className="mt-4 text-sm text-red-800">Some items are unavailable or require attention before checkout.</p>}
          <p className="mt-4 text-xs leading-relaxed text-neutral-600">{quote.note}</p>
          <StripeTestCheckoutControl storeId={storeId}
            allDigital={quote.items.length>0 && quote.items.every(item=>item.fulfillment==="DIGITAL")}
            cartKey={JSON.stringify(quote.items.map(item=>[item.variantId,item.quantity,item.unitPriceMinor]))}/>
        </aside>
      </div>}
    </main>
  );
}
