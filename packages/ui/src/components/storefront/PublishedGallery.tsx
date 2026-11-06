"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {HeartIcon as HeartSolid} from "@heroicons/react/24/solid";
import {HeartIcon as HeartOutline} from "@heroicons/react/24/outline";
import {useFavorites} from "@acme/core/contexts/FavoriteContext";
import {useUser} from "@acme/core/contexts/UserContext";
import {fetchPublishedStore,fetchPublishedListings,catalogMediaPath,formatCatalogPrice,isPublicOriginal,type PublicCatalogItem,type PublicVariant} from "@acme/core/lib/public-catalog-view";
import {listStoreFavorites} from "@acme/core/lib/client/storefront-commerce";

type Props={favoritesOnly?:boolean;originalsOnly?:boolean;kind?:string};
function hasKind(variant:PublicVariant,kind:string,categories:readonly string[]=[]){
  if(categories.some(category=>category.toUpperCase()===kind))return true;
  if(kind==="ALL")return true;
  const attrs=variant.attributes;
  if(!attrs||typeof attrs!=="object"||Array.isArray(attrs))return false;
  const values=attrs as Record<string,unknown>;
  return [values.kind,values.productKind,values.category].some(value=>typeof value==="string"&&value.toUpperCase()===kind);
}
export default function PublishedGallery({favoritesOnly=false,originalsOnly=false,kind="ALL"}:Props){
  const {favorites,ready,toggleFavorite}=useFavorites();
  const {isLoggedIn}=useUser();
  const [storeId,setStoreId]=useState<string|null>(null);
  const [items,setItems]=useState<PublicCatalogItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [busyId,setBusyId]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError(null);
    void(async()=>{
      try{
        const context=await fetchPublishedStore(controller.signal);
        const result=favoritesOnly?await listStoreFavorites(context.store.id):await fetchPublishedListings(context.store.id,controller.signal);
        if(controller.signal.aborted)return;
        if(result.store.id!==context.store.id)throw new Error("Storefront mismatch");
        setStoreId(context.store.id);setItems(result.products);
      }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Gallery unavailable");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[favoritesOnly]);
  const visible=useMemo(()=>items.map(item=>{
    const variants=item.product.variants.filter(v=>(!originalsOnly||isPublicOriginal(v))&&hasKind(v,kind,item.product.categories));
    const best=[...variants].sort((a,b)=>Number(b.available)-Number(a.available)||a.priceMinor-b.priceMinor)[0];
    return {item,best};
  }).filter((row):row is {item:PublicCatalogItem;best:PublicVariant}=>Boolean(row.best)&&(!favoritesOnly||(ready&&favorites.has(row.item.product.id)))),[items,originalsOnly,kind,favoritesOnly,ready,favorites]);
  if(loading)return <p role="status" className="py-10 text-center text-neutral-500">Loading artworks…</p>;
  if(error)return <p role="alert" className="py-10 text-center text-red-700">{error}</p>;
  if(visible.length===0)return <p className="py-16 text-center text-neutral-500">No artworks available in this collection.</p>;
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mt-8">
    {visible.map(({item,best})=>{
      const media=item.product.publicMedia[0];
      const liked=favorites.has(item.product.id);
      const img=storeId&&media?catalogMediaPath(storeId,media.assetId):null;
      return <article key={item.slug} className="group relative rounded-2xl border border-neutral-200 bg-white/80 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4">
        <button type="button" aria-label={liked?"Remove from favorites":"Add to favorites"}
          disabled={!ready||busyId===item.product.id}
          title={!isLoggedIn?"Sign in to save favorites":undefined}
          onClick={()=>{
            if(!isLoggedIn){window.location.assign("/authenticate");return;}
            setBusyId(item.product.id);
            void toggleFavorite(item.product.id).catch(()=>setError("Could not update favorites")).finally(()=>setBusyId(null));
          }} className="absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white/70 backdrop-blur-sm p-1.5 hover:bg-white transition-colors disabled:opacity-50">
          {liked?<HeartSolid className="h-[18px] w-[18px] text-neutral-900"/>:<HeartOutline className="h-[18px] w-[18px] text-neutral-400 group-hover:text-neutral-700"/>}
        </button>
        <Link href={`/store/${encodeURIComponent(item.slug)}`} className="block">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-neutral-100">
            {img?<img src={img} alt={media?.altText||item.product.title} loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"/>:
              <div className="flex h-full items-center justify-center text-xs text-neutral-500">Preview unavailable</div>}
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <h3 className="text-[13px] font-medium tracking-wide text-neutral-900 group-hover:underline">{item.product.title}</h3>
              <p className="text-sm font-medium text-neutral-900">{formatCatalogPrice(best.priceMinor,best.currency)}</p>
              {!best.available&&<p className="text-xs text-neutral-500">Unavailable</p>}
            </div>
          </div>
        </Link>
      </article>;
    })}
  </div>;
}
