"use client";
import {useEffect,useMemo,useState} from "react";
import Gallery from "../store/Gallery";
import {useFavorites} from "@acme/core/contexts/FavoriteContext";
import {fetchPublishedStore,fetchPublishedListings,type PublicCatalogItem,type PublicVariant} from "@acme/core/lib/public-catalog-view";
import {listStoreFavorites} from "@acme/core/lib/client/storefront-commerce";
import {hasCatalogKind,projectOriginalGalleryItem} from "@acme/core/lib/client/original-ui-catalog";

/** Original /store and /favorites card markup; canonical published catalog behind it. */
export default function OriginalPublishedGallery({kind="ALL",favoritesOnly=false}:{kind?:string;favoritesOnly?:boolean}){
  const [storeId,setStoreId]=useState<string|null>(null);
  const [items,setItems]=useState<PublicCatalogItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const {favorites,ready}=useFavorites();
  useEffect(()=>{
    const abort=new AbortController();setLoading(true);setError(null);
    void(async()=>{
      try{
        const context=await fetchPublishedStore(abort.signal);
        const result=favoritesOnly?await listStoreFavorites(context.store.id):await fetchPublishedListings(context.store.id,abort.signal);
        if(abort.signal.aborted)return;
        if(result.store.id!==context.store.id)throw new Error("Storefront mismatch");
        setStoreId(context.store.id);setItems(result.products);
      }catch(cause){if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:"Gallery unavailable");}
      finally{if(!abort.signal.aborted)setLoading(false);}
    })();
    return()=>abort.abort();
  },[favoritesOnly]);
  const products=useMemo(()=>{
    if(!storeId)return [];
    return items.flatMap(item=>{
      if(favoritesOnly&&(!ready||!favorites.has(item.product.id)))return [];
      const eligible=item.product.variants.filter(variant=>hasCatalogKind(item,variant,kind));
      const best=[...eligible].sort((a,b)=>Number(b.available)-Number(a.available)||a.priceMinor-b.priceMinor)[0];
      return best?[projectOriginalGalleryItem(storeId,item,best)]:[];
    });
  },[items,storeId,kind,favoritesOnly,ready,favorites]);
  if(loading)return <p className="py-10 text-center text-neutral-500" role="status">Loading artworks…</p>;
  if(error)return <p className="py-10 text-center text-red-700" role="alert">{error}</p>;
  if(products.length===0)return <p className="py-16 text-center text-neutral-500">No artworks available in this collection.</p>;
  return <Gallery products={products}/>;
}
