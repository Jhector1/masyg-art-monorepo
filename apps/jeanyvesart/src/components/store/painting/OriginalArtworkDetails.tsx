"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {HeartIcon as HeartSolid} from "@heroicons/react/24/solid";
import {HeartIcon as HeartOutline} from "@heroicons/react/24/outline";
import {catalogMediaPath,fetchPublishedStore,fetchPublishedListing,isPublicOriginal,formatCatalogPrice,type PublicCatalogDetail} from "@acme/core/lib/public-catalog-view";
import {useFavorites} from "@acme/core/contexts/FavoriteContext";
import {useUser} from "@acme/core/contexts/UserContext";
import {addStoreVariant} from "@acme/core/lib/client/storefront-commerce";

export default function OriginalArtworkDetails({slug}:{slug:string}) {
  const [data,setData]=useState<PublicCatalogDetail|null>(null);
  const [activeImg,setActiveImg]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState<string|null>(null);
  const {isFavorite,toggleFavorite,ready}=useFavorites();
  const {isLoggedIn}=useUser();
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError(null);setData(null);
    void(async()=>{
      try{
        const current=await fetchPublishedStore(controller.signal);
        const listing=await fetchPublishedListing(current.store.id,slug,controller.signal);
        if(controller.signal.aborted)return;
        if(current.store.id!==listing.store.id || !listing.product.variants.some(isPublicOriginal))throw new Error("Original unavailable");
        setData(listing);
        const asset=listing.product.publicMedia[0];
        setActiveImg(asset?catalogMediaPath(listing.store.id,asset.assetId):null);
      }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Artwork unavailable");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[slug]);
  const original=data?.product.variants.find(isPublicOriginal);
  const available=Boolean(original?.available);
  const attrs=original?.attributes && typeof original.attributes==="object" && !Array.isArray(original.attributes)
    ?original.attributes as Record<string,unknown>:{};
  const specs=["medium","surface","year","widthIn","heightIn","depthIn"].filter(key=>typeof attrs[key]==="string"||typeof attrs[key]==="number");
  async function addToCart(){
    if(!data||!original||busy||!original.available)return;
    setBusy(true);setMessage(null);
    try{
      await addStoreVariant(data.store.id,original.id,1);
      setMessage("Added to cart");
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to update cart");}
    finally{setBusy(false);}
  }
  return <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
    <Link href="/store" className="mb-5 inline-block text-sm text-neutral-500 hover:text-neutral-900">← Back to originals</Link>
    <section className="w-full rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      {loading?<div role="status" className="mt-6 h-64 animate-pulse rounded-xl bg-neutral-100"/>:
      error?<p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>:
      data&&original&&<>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] tracking-wide">Original</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide ${available?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-neutral-200 bg-neutral-100 text-neutral-600"}`}>{available?"Available":"Unavailable"}</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">{data.product.title}</h1>
          </div>
          <button type="button" disabled={!ready||busy||!isLoggedIn} onClick={()=>void toggleFavorite(data.product.id)}
            title={!isLoggedIn?"Sign in to save favorites":undefined} aria-label={isFavorite(data.product.id)?"Remove from favorites":"Add to favorites"}
            className="rounded-full border border-neutral-200 bg-white/90 px-3 py-2 transition hover:bg-neutral-50 disabled:opacity-50">
            {isFavorite(data.product.id)?<HeartSolid className="h-5 w-5"/>:<HeartOutline className="h-5 w-5"/>}
          </button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              {activeImg?<img src={activeImg} alt={data.product.title} className="h-full w-full object-contain"/>:<div className="flex h-full items-center justify-center text-neutral-500">Preview unavailable</div>}
            </div>
            {data.product.publicMedia.length>1&&<div className="mt-3 grid grid-cols-5 gap-2">
              {data.product.publicMedia.slice(0,12).map((m,i)=>{
                const src=catalogMediaPath(data.store.id,m.assetId);
                return <button key={m.assetId} type="button" onClick={()=>setActiveImg(src)} aria-label={`Thumbnail ${i+1}`}
                  className={`relative aspect-square overflow-hidden rounded-md border transition ${src===activeImg?"border-neutral-900":"border-neutral-200 hover:border-neutral-400"}`}>
                  <img src={src} alt={m.altText||`Artwork preview ${i+1}`} className="h-full w-full object-cover"/>
                </button>;
              })}
            </div>}
          </div>
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-neutral-900">{formatCatalogPrice(original.priceMinor,original.currency)}</p>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">{data.product.description||"No description."}</p>
            {specs.length>0&&<dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-neutral-200 pt-5">
              {specs.map(key=><div key={key}><dt className="text-xs capitalize text-neutral-500">{key.replace(/In$/, " (in)")}</dt><dd className="mt-1 text-sm text-neutral-900">{String(attrs[key])}</dd></div>)}
            </dl>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" disabled={!available||busy} onClick={()=>void addToCart()}
                className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                {busy?"Adding…":available?"Add to Cart":"Unavailable"}
              </button>
              <button type="button" disabled title="Checkout will be enabled after provider settlement tests" className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-400 disabled:cursor-not-allowed">Checkout now</button>
              <Link href="/cart" className="rounded-xl border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">View cart</Link>
            </div>
            {message&&<p className="mt-4 text-sm" role="status">{message}</p>}
            <p className="mt-4 text-xs text-neutral-500">Checkout remains unavailable until the payment provider is enabled and verified.</p>
          </div>
        </div>
        <div className="mt-8 border-t border-neutral-100 pt-6"><h2 className="text-lg font-semibold text-neutral-900">Reviews</h2><p className="mt-2 text-sm text-neutral-500">Verified purchase reviews will be available after the canonical review service is connected.</p></div>
      </>}
    </section>
  </main>;
}
