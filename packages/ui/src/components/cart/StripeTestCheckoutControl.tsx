"use client";
import { useEffect, useRef, useState } from "react";
import { mayRetryExpiredPreparedCheckout } from "@acme/core/lib/stripe-test-checkout-retry-policy";

type Billing={recipient:string;line1:string;line2:string;city:string;region:string;postalCode:string;country:string};
const empty:Billing={recipient:"",line1:"",line2:"",city:"",region:"",postalCode:"",country:"US"};
/** UI remains unchanged unless the server explicitly enables TEST Stripe checkout.
 * Never submit prices, IDs, merchant accounts or success status from the browser. */
export default function StripeTestCheckoutControl({storeId,allDigital,cartKey,theme="default"}:{
  storeId:string|null;allDigital:boolean;cartKey:string;theme?:"default"|"original-ziledigital";
}) {
  const [enabled,setEnabled]=useState(false);
  const [mixedEnabled,setMixedEnabled]=useState(false);
  const [checked,setChecked]=useState(false);
  const [billing,setBilling]=useState<Billing>(empty);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const previous=useRef<{key:string;nonce:string}|null>(null);
  useEffect(()=>{
    let active=true;
    setEnabled(false);setMixedEnabled(false);setChecked(false);
    if(!storeId){setChecked(true);return;}
    (async()=>{
      try {
        const response=await fetch(`/api/public/stores/${storeId}/checkout/test`,{cache:"no-store",credentials:"same-origin"});
        const data=await response.json();
        if(active){ setEnabled(response.ok && data.enabled===true && data.mode==="test");
          setMixedEnabled(response.ok && data.mixedEnabled===true && data.mode==="test"); }
      } catch {if(active)setEnabled(false);} finally {if(active)setChecked(true);}
    })();
    return ()=>{active=false;};
  },[storeId]);
  async function submit(event:React.FormEvent) {
    event.preventDefault();
    if(!storeId || submitting || (!allDigital && !mixedEnabled)) return;
    setSubmitting(true);setError(null);
    try {
      if(!previous.current || previous.current.key!==cartKey)
        previous.current={key:cartKey,nonce:crypto.randomUUID()};
      // The server may rotate a nonce only AFTER transactional expiration of
      // an unsubmitted PREPARED attempt. All uncertain Stripe states remain blocked.
      let checkoutUrl:string|null=null;
      for(let attempt=0;attempt<2;attempt++) {
        const response=await fetch(`/api/public/stores/${storeId}/checkout/test`,{
          method:"POST",cache:"no-store",credentials:"same-origin",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({idempotencyKey:previous.current.nonce,billingAddress:{
            ...billing,line2:billing.line2||undefined,
            country:billing.country.trim().toUpperCase(),
          }}),
        });
        const result=await response.json().catch(()=>null);
        if(!response.ok) {
          if(mayRetryExpiredPreparedCheckout(response.status,result)) {
            previous.current={key:cartKey,nonce:crypto.randomUUID()};
            if(attempt===0) continue;
          }
          throw new Error(result?.error || "Test checkout unavailable");
        }
        if(typeof result?.checkoutUrl!=="string") throw new Error("Checkout address missing");
        checkoutUrl=result.checkoutUrl;
        break;
      }
      if(!checkoutUrl) throw new Error("Unable to prepare a fresh checkout");
      const url=new URL(checkoutUrl);
      if(url.protocol!=="https:" || url.hostname!=="checkout.stripe.com") throw new Error("Unsafe payment destination");
      window.location.assign(url.toString());
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Test checkout failed");
      setSubmitting(false);
    }
  }
  if (!checked || !enabled) return <>
    <button type="button" disabled aria-disabled="true"
      className={theme==="original-ziledigital" ? "w-full rounded-full bg-gray-400 px-6 py-2 text-white cursor-not-allowed shadow" : "mt-5 w-full cursor-not-allowed rounded-xl bg-neutral-300 px-4 py-3 font-medium text-neutral-600"}>
      {theme==="original-ziledigital" ? "Proceed to Checkout" : "Checkout not yet available"}</button>
    <p className="mt-3 text-xs text-neutral-500">Payment creation is disabled while the new shared commerce system is being validated.</p>
  </>;
  if(!allDigital && !mixedEnabled) return <p role="status" className="mt-5 text-sm text-amber-800">
    Physical test checkout requires a verified merchant shipping configuration and server activation.
  </p>;
  return <form className="mt-5 space-y-3" onSubmit={submit}>
    <p className="text-sm font-medium text-neutral-900">Stripe test checkout</p>
    <p className="text-xs text-neutral-600">Test cards only. Sign in first. For physical goods this address is used as both billing and shipping; tax and delivery are calculated by the server.</p>
    {([ ["recipient","Full name"],["line1","Address line 1"],["line2","Address line 2 (optional)"],
      ["city","City"],["region","State / region code (e.g. IL)"],["postalCode","Postal code"],["country","Country code (e.g. US)"] ] as const).map(([field,label])=>
      <label key={field} className="block text-xs text-neutral-700">{label}
        <input type="text" required={field!=="line2"} autoComplete="off" maxLength={160}
          value={billing[field]} onChange={event=>setBilling(current=>({...current,[field]:event.target.value}))}
          className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"/>
      </label>)}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={submitting}
      className={theme==="original-ziledigital" ? "w-full rounded-full bg-green-600 hover:bg-green-700 px-6 py-2 text-white shadow transition disabled:opacity-50" : "w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-50"}>
      {submitting?"Opening secure test checkout…":theme==="original-ziledigital" ? "Proceed to Checkout" : "Continue to Stripe test checkout"}
    </button>
  </form>;
}
