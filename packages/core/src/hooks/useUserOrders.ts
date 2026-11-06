"use client";
import {useEffect,useState} from "react";
import type {CollectionItem,VariantType} from "../types";
import {getCurrentStorefront,listStoreOrders,type BuyerOrder} from "../lib/client/storefront-commerce";

export type OrdersByGroup=Record<string,CollectionItem[]>;
export type OrdersFilter=VariantType|"ALL";

/** Only genuinely paid/fulfilling orders appear as purchased artwork. Never trust a query userId. */
export function ordersToCollection(orders:BuyerOrder[], storeId?:string):OrdersByGroup {
  const grouped:OrdersByGroup={};
  for(const order of orders){
    if(!["PAID","FULFILLING","FULFILLED"].includes(order.status))continue;
    for(const item of order.items){
      const mediaId=item.variant?.product?.media?.[0]?.assetId;
      const preview=storeId && mediaId
        ? `/api/public/stores/${encodeURIComponent(storeId)}/media/${encodeURIComponent(mediaId)}` : null;
      const row:CollectionItem={
        id:item.id,
        type:item.fulfillment==="DIGITAL"?"DIGITAL":"PRINT",
        price:item.unitPriceMinor / (10**currencyDigits(order.currency)),
        currency:order.currency,
        quantity:item.quantity,
        order:{id:order.id,isUserDesign:false,placedAt:order.createdAt,status:order.status,stripeSessionId:null},
        product:{id:item.variant?.productId??"",title:item.titleSnapshot,thumbnails:preview?[preview]:[]},
        previewUrl:preview,
        ...(item.fulfillment==="DIGITAL"?{digital:{variantId:null,format:null,license:null,size:null,tokens:[]}}:{}),
      };
      (grouped[order.createdAt.slice(0,10)]??=[]).push(row);
    }
  }
  return grouped;
}
function currencyDigits(currency:string){
  try {return new Intl.NumberFormat("en-US",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2;}
  catch{return 2;}
}
export function useUserOrdersData(){
  const [rawData,setRawData]=useState<OrdersByGroup>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<Error|null>(null);
  useEffect(()=>{
    let active=true;
    void(async()=>{
      setLoading(true);setError(null);
      try{
        const context=await getCurrentStorefront();
        const response=await listStoreOrders(context.store.id);
        if(active)setRawData(ordersToCollection(response.orders,context.store.id));
      }catch(e){if(active){setRawData({});setError(e instanceof Error?e:new Error("Could not load purchases"));}}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[]);
  return {rawData,loading,error};
}
export function selectFlat(raw:OrdersByGroup){return Object.values(raw).flat();}
export function selectFiltered(items:CollectionItem[],filter:OrdersFilter){return filter==="ALL"?items:items.filter(i=>i.type===filter);}
export function groupByDate(items:CollectionItem[]){return items.reduce<OrdersByGroup>((out,item)=>{
  const date=item.order.placedAt.slice(0,10);(out[date]??=[]).push(item);return out;
},{});}
