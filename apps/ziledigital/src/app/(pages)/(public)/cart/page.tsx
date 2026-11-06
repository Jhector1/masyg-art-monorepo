"use client";
import {useEffect,useMemo,useState} from "react";
import SEO from "@acme/ui/components/SEO";
import Gallery from "@acme/ui/components/store/Gallery";
import StripeTestCheckoutControl from "@acme/ui/components/cart/StripeTestCheckoutControl";
import {useStoreCart} from "@acme/core/hooks/useStoreCart";
import {fetchPublishedListings,type PublicCatalogItem} from "@acme/core/lib/public-catalog-view";
import {projectOriginalCartItems,originalGalleryMoney} from "@acme/core/lib/client/original-ui-catalog";

/** /cart restores main's card grid + summary layout; all mutations stay canonical. */
export default function CartPage() {
  const {storeId,quote,loading,error,reload,setQuantity,busyVariantId}=useStoreCart();
  const [listings,setListings]=useState<PublicCatalogItem[]>([]);
  useEffect(()=>{
    if(!storeId){setListings([]);return;}
    const ctrl=new AbortController();
    void fetchPublishedListings(storeId,ctrl.signal).then(result=>{
      if(!ctrl.signal.aborted&&result.store.id===storeId)setListings(result.products);
    }).catch(()=>{if(!ctrl.signal.aborted)setListings([]);});
    return()=>ctrl.abort();
  },[storeId]);
  const products=useMemo(()=>quote&&storeId?projectOriginalCartItems(quote,storeId,listings):[],[quote,storeId,listings]);
  const allDigital=Boolean(quote?.items.length)&&quote!.items.every(item=>item.fulfillment==="DIGITAL");
  const cartKey=JSON.stringify(quote?.items.map(item=>[item.variantId,item.quantity,item.unitPriceMinor])??[]);
  return <>
    <SEO title="Your Cart" description="Review and manage items in your cart before checkout."/>
    <div className="max-w-7xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-green-700 mb-4">Your Cart</h1>
      {loading?<div className="text-center py-10">Loading your cart…</div>
        :error?<div role="alert" className="text-red-700">{error} <button onClick={()=>{void reload()}} className="underline">Retry</button></div>
        :!quote||products.length===0?<p className="text-gray-600">Your cart is empty.</p>
        :<>
          <Gallery products={products} showCartItem showLikeButton={false}
            onRemoveCartVariant={async variantId=>{await setQuantity(variantId,0);}}/>
          <div className="mt-10 flex justify-between items-center border-t pt-6 gap-6 flex-wrap">
            <span className="text-xl font-semibold text-gray-800">
              Total: {quote.currency?originalGalleryMoney(quote.subtotalMinor,quote.currency):"Unavailable"}
            </span>
            <div className="w-full max-w-sm">
              {quote.issues.length>0&&<p className="mb-3 text-sm text-red-700">Some items are currently unavailable.</p>}
              {busyVariantId&&<p className="mb-3 text-sm text-gray-500">Updating your cart…</p>}
              <StripeTestCheckoutControl storeId={storeId} allDigital={allDigital&&quote.issues.length===0} cartKey={cartKey} theme="original-ziledigital" />
            </div>
          </div>
        </>}
    </div>
  </>;
}
