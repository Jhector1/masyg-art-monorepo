"use client";
import {useEffect,useState} from "react";

type Rate={country:string;region:string;currency:string;amountMinor:number;enabled:boolean};
type Settings={enabled:boolean;physicalTaxCode:string|null;shippingTaxCode:string|null;rates:Rate[]};
const blank:Settings={enabled:false,physicalTaxCode:null,shippingTaxCode:null,rates:[]};
export default function StoreShippingSettings({organizationId,storeId}:{organizationId:string;storeId:string}) {
  const [settings,setSettings]=useState<Settings>(blank);
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [message,setMessage]=useState("");
  const url=`/api/merchant/organizations/${organizationId}/stores/${storeId}/shipping`;
  useEffect(()=>{
    let current=true;
    setLoaded(false);setMessage("");
    fetch(url,{cache:"no-store",credentials:"same-origin"})
      .then(async response=>{const data=await response.json();if(!response.ok) throw new Error(data.error||"Unable to load shipping");return data as Settings;})
      .then(data=>{if(current)setSettings(data);})
      .catch(error=>{if(current)setMessage(error instanceof Error?error.message:"Unable to load shipping");})
      .finally(()=>{if(current)setLoaded(true);});
    return ()=>{current=false;};
  },[url]);
  function changeRate(i:number,patch:Partial<Rate>){setSettings(s=>({...s,rates:s.rates.map((r,j)=>i===j?{...r,...patch}:r)}));}
  async function save(event:React.FormEvent) {
    event.preventDefault();if(busy)return;
    setBusy(true);setMessage("");
    try {
      const res=await fetch(url,{method:"PUT",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not save shipping");
      setSettings(data as Settings);setMessage("Test shipping settings saved. Live payments remain unaffected.");
    } catch(e){setMessage(e instanceof Error?e.message:"Could not save shipping");}
    finally{setBusy(false);}
  }
  return <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
    <div><h2 className="font-semibold text-lg">Test checkout shipping</h2>
      <p className="text-sm text-zinc-600">Configure flat shipping per storefront. Payment remains test-only and requires a separate server-side feature flag.</p></div>
    {!loaded?<p>Loading shipping configuration…</p>:<form onSubmit={save} className="space-y-4">
      <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({...s,enabled:e.target.checked}))}/>
        Enable this storefront for mixed Stripe TEST checkout (requires separate server opt-in)</label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">Physical product Stripe Tax code
          <input className="mt-1 block w-full rounded border px-3 py-2" placeholder="txcd_12345678" value={settings.physicalTaxCode??""}
            onChange={e=>setSettings(s=>({...s,physicalTaxCode:e.target.value.trim()||null}))}/></label>
        <label className="block text-sm">Shipping Stripe Tax code (required for paid shipping)
          <input className="mt-1 block w-full rounded border px-3 py-2" placeholder="txcd_12345678" value={settings.shippingTaxCode??""}
            onChange={e=>setSettings(s=>({...s,shippingTaxCode:e.target.value.trim()||null}))}/></label>
      </div>
      <p className="text-xs text-zinc-500">Select accurate Stripe Tax categories for the products and shipping service. Test mode does not establish tax compliance.</p>
      {settings.rates.map((rate,i)=><div key={i} className="grid gap-2 rounded-lg border bg-zinc-50 p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
        {(["country","region","currency"] as const).map(field=><label key={field} className="text-xs capitalize">{field}{field==="region"?" (optional)":""}
          <input className="mt-1 w-full rounded border p-2" maxLength={field==="region"?16:3} value={rate[field]}
            onChange={e=>changeRate(i,{[field]:e.target.value})}/></label>)}
        <label className="text-xs">Shipping (minor units; cents for USD)
          <input type="number" min="0" max="2147483647" step="1" className="mt-1 w-full rounded border p-2" value={rate.amountMinor}
            onChange={e=>changeRate(i,{amountMinor:Number(e.target.value)})}/></label>
        <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={rate.enabled} onChange={e=>changeRate(i,{enabled:e.target.checked})}/> Active</label>
        <button type="button" className="text-xs text-red-700 underline" onClick={()=>setSettings(s=>({...s,rates:s.rates.filter((_,j)=>j!==i)}))}>Remove</button>
      </div>)}
      <button type="button" className="rounded border px-3 py-2 text-sm" onClick={()=>setSettings(s=>({...s,rates:[...s.rates,{country:"US",region:"",currency:"USD",amountMinor:0,enabled:true}]}))}>
        Add flat rate</button>
      <p className="text-xs text-zinc-500">Leave region blank for a countrywide rate. A matching regional rate overrides the countrywide rate.</p>
      <div><button disabled={busy} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">{busy?"Saving…":"Save shipping settings"}</button></div>
    </form>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
