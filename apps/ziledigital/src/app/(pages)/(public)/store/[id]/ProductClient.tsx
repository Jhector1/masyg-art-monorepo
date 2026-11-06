"use client";

import { useEffect, useState } from "react";
import ProductImageGallery from "@acme/ui/components/product/detail/ProductImageGallery";
import {
  catalogMediaPath, fetchPublishedListing, fetchPublishedStore,
  type PublicCatalogDetail,
} from "@acme/core/lib/public-catalog-view";
import CanonicalArtInfoModel from "../../../../../components/CanonicalArtInfoModel";

/**
 * The original ZileDigital product-detail DOM and gallery remain the visual source of truth.
 * Only the data adapter differs: canonical host-bound catalog, actual variants, secure cart.
 */
export default function ProductDetail({slug}:{slug:string}) {
  const [product,setProduct] = useState<PublicCatalogDetail|null>(null);
  const [preview,setPreview] = useState<{src:string;alt:string}|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);

  useEffect(()=>{
    const controller = new AbortController();
    setLoading(true); setError(null); setProduct(null); setPreview(null);
    void (async()=>{
      try {
        const context=await fetchPublishedStore(controller.signal);
        const result=await fetchPublishedListing(context.store.id,slug,controller.signal);
        if(controller.signal.aborted)return;
        if(result.store.id!==context.store.id || result.slug!==slug) throw new Error("Storefront mismatch");
        const first=result.product.publicMedia[0];
        setProduct(result);
        setPreview(first?{
          src:catalogMediaPath(result.store.id,first.assetId),
          alt:first.altText||result.product.title,
        }:null);
      }catch(reason){
        if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Artwork unavailable");
      }finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[slug]);

  const thumbnails=product?.product.publicMedia.map(media=>catalogMediaPath(product.store.id,media.assetId))??[];
  const loadingUI=<div className="p-10 text-center">Loading product…</div>;

  return <>
    {!product ? (
      error?<div className="p-10 text-center text-red-700" role="alert">{error}</div> : loading ? loadingUI : null
    ) : (
      <main className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 pt-8 lg:pt-12">
        <h1 className="sr-only">{product.product.title}</h1>
        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {thumbnails.length>0 ? (
            <ProductImageGallery product={{thumbnails}} preview={preview} setPreview={setPreview}/>
          ) : (
            <div className="min-h-[300px] lg:min-h-[65vh] grid place-items-center rounded-2xl bg-gray-50 text-gray-500">
              Preview unavailable
            </div>
          )}
          <div className="min-w-0">
            <h2 className="mb-5 text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">{product.product.title}</h2>
            <CanonicalArtInfoModel product={product}/>
          </div>
        </div>
        {/* The historical review block is intentionally omitted until the tenant-scoped
            review service has been restored; no retired review endpoint is called. */}
        <div className="mt-14" />
      </main>
    )}
  </>;
}
