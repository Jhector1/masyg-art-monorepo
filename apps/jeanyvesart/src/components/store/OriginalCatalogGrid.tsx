"use client";
import {useEffect,useMemo,useState} from "react";
import ProductGridOriginal from "./ProductGrid";
import type {Product} from "@/lib/products";
import {catalogMediaPath,fetchPublishedStore,fetchPublishedListings,isPublicOriginal,type PublicCatalogItem} from "@acme/core/lib/public-catalog-view";
import {listStoreFavorites} from "@acme/core/lib/client/storefront-commerce";
import {useFavorites} from "@acme/core/contexts/FavoriteContext";

type OriginalCard=Product & {slug:string};
export function originalsFromListings(storeId:string,items:PublicCatalogItem[]):OriginalCard[] {
  const originals:OriginalCard[]=[];
  for(const item of items){
    const variant=item.product.variants.find(isPublicOriginal);
    if(!variant)continue;
    const attrs=variant.attributes && typeof variant.attributes==="object" && !Array.isArray(variant.attributes)
      ? variant.attributes as Record<string,unknown>:{};
    const numeric=(key:string)=>{const value=attrs[key];return typeof value==="number"&&Number.isFinite(value)?value:null;};
    const digits=(()=>{try{return new Intl.NumberFormat("en-US",{style:"currency",currency:variant.currency}).resolvedOptions().maximumFractionDigits??2;}catch{return 2;}})();
    originals.push({id:item.product.id,slug:item.slug,title:item.product.title,
      description:item.product.description,price:variant.priceMinor/(10**digits),currency:variant.currency,
      thumbnails:item.product.publicMedia.map(m=>catalogMediaPath(storeId,m.assetId)),
      variants:[{id:variant.id,type:"ORIGINAL",status:variant.available?"ACTIVE":"SOLD",
        inventory:variant.available?1:0,listPrice:variant.priceMinor/(10**digits),
        widthIn:numeric("widthIn"),heightIn:numeric("heightIn"),depthIn:numeric("depthIn"),year:numeric("year")}],
    });
  }
  return originals;
}
export default function OriginalCatalogGrid({limit=50,favoritesOnly=false}:{limit?:number;favoritesOnly?:boolean}) {
  const [products,setProducts]=useState<OriginalCard[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const {favorites,ready}=useFavorites();
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError(null);
    void(async()=>{
      try{
        const context=await fetchPublishedStore(controller.signal);
        const listing=favoritesOnly
          ?await listStoreFavorites(context.store.id)
          :await fetchPublishedListings(context.store.id,controller.signal);
        if(controller.signal.aborted)return;
        if(listing.store.id!==context.store.id)throw new Error("Storefront mismatch");
        setProducts(originalsFromListings(context.store.id,listing.products));
      }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:"Could not load artworks");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[favoritesOnly]);
  const visible=useMemo(()=>products.filter(p=>!favoritesOnly || (ready&&favorites.has(p.id))).slice(0,limit),[products,ready,favorites,favoritesOnly,limit]);
  if(loading)return <p role="status" className="py-16 text-center text-neutral-400">Loading artworks…</p>;
  if(error)return <p role="alert" className="py-16 text-center text-red-700">{error}</p>;
  return <ProductGridOriginal products={visible}/>;
}
