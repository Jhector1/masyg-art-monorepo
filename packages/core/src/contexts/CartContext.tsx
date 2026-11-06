"use client";

import React, {createContext,useCallback,useContext,useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {useUser} from "./UserContext";
import type {AddToCartResponse,CartSelectedItem,CartUpdates,DesignPayload} from "../types";
import {
  addStoreVariant,getCurrentStorefront,getStoreCart,listStoreProducts,setStoreVariantQuantity,
  STORE_CART_UPDATED_EVENT,type CartQuote,type PublicStoreProduct,
} from "../lib/client/storefront-commerce";
import {projectLegacyCart,uniquePublishedVariant,assertOrdinaryCartSelection,assertRepresentedSelection} from "../lib/client/legacy-cart-bridge";

/** Compatibility API for existing visual components. All I/O uses the server-resolved
 * published store and canonical variant cart. No browser-selected tenant, price or payment.
 */
export type CartContextType={
 cart:CartSelectedItem[]; loadingCart:boolean; loadingAdd:boolean; totalPrice:number;
 refreshCart:()=>Promise<void>;
 addToCart:(productId:string,digitalType:string|null,printType:string|null,
  format:string,size:string|null,material:string|null,frame:string|null,
  license:string,quantity?:number)=>Promise<AddToCartResponse>;
 addToCartWithDesign:(args:{productId:string;digitalType:string|null;printType:string|null;
  format:string;size:string|null;material:string|null;frame:string|null;license:string;
  quantity?:number;design?:DesignPayload;snapshot?:boolean})=>Promise<AddToCartResponse>;
 removeFromCart:(productId:string,digitalVariantId:string,printVariantId:string)=>Promise<void>;
 updateCart:(args:{productId:string;printVariantId?:string;digitalVariantId?:string;updates:CartUpdates})=>Promise<void>;
};
const defaultContext:CartContextType={
 cart:[],loadingCart:false,loadingAdd:false,totalPrice:0,
 refreshCart:async()=>{},addToCart:async()=>({result:undefined}),
 addToCartWithDesign:async()=>({result:undefined}),removeFromCart:async()=>{},updateCart:async()=>{},
};
const Context=createContext<CartContextType>(defaultContext);
export const useCart=()=>useContext(Context);

/** Public product lookup is scoped to the canonical storefront. We do not accept an
 * unverified productId as a variant, and do not silently select among multiple variants.
 */
async function findPublicProduct(storeId:string,productId:string):Promise<PublicStoreProduct>{
 for(let page=1;page<=20;page++){
  const batch=await listStoreProducts(storeId,{page,limit:50});
  if(batch.store.id!==storeId) throw new Error("Storefront mismatch");
  const found=batch.products.find(item=>item.product.id===productId);
  if(found)return found;
  if(batch.products.length<50)break;
 }
 throw new Error("Product is not available in the selected storefront");
}

export function CartProvider({children}:{children:React.ReactNode}){
 const {isLoggedIn}=useUser();
 const pathname=usePathname();
 const [quote,setQuote]=useState<CartQuote|null>(null);
 const [storeId,setStoreId]=useState<string|null>(null);
 const [loadingCart,setLoadingCart]=useState(true);
 const [loadingAdd,setLoadingAdd]=useState(false);

 const refreshCart=useCallback(async()=>{
  try{
   const context=await getCurrentStorefront();
   const current=await getStoreCart(context.store.id);
   setStoreId(context.store.id);
   setQuote(current);
  }catch{
   // Background header cart is nonessential. The canonical /cart page displays
   // actual request errors, while this provider must never trigger a dev overlay.
   setQuote(null);setStoreId(null);
  }finally{setLoadingCart(false)}
 },[]);
 useEffect(()=>{void refreshCart()},[refreshCart,isLoggedIn,pathname]);
 useEffect(()=>{
  const update=()=>{void refreshCart()};
  const visible=()=>{if(document.visibilityState==="visible")update()};
  window.addEventListener(STORE_CART_UPDATED_EVENT,update);
  window.addEventListener("focus",update);
  document.addEventListener("visibilitychange",visible);
  return()=>{window.removeEventListener(STORE_CART_UPDATED_EVENT,update);
   window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",visible)};
 },[refreshCart]);

 const requireStore=useCallback(async()=>storeId??(await getCurrentStorefront()).store.id,[storeId]);
 const addToCart:CartContextType["addToCart"]=async(productId,digitalType,printType,
  format,size,material,frame,license,quantity=1)=>{
  assertOrdinaryCartSelection({digitalType,printType});
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>20)throw new Error("Invalid cart quantity");
  setLoadingAdd(true);
  try{
   const id=await requireStore();
   const listing=await findPublicProduct(id,productId);
   const variant=uniquePublishedVariant(listing,digitalType?"DIGITAL":"PHYSICAL");
   assertRepresentedSelection(variant,{format,size,material,frame,license});
   await addStoreVariant(id,variant.id,quantity);
   await refreshCart();
   return {result:{cartItemId:variant.id,
    digitalVariantId:digitalType?variant.id:undefined,
    printVariantId:printType?variant.id:undefined}};
  }finally{setLoadingAdd(false)}
 };
 const addToCartWithDesign:CartContextType["addToCartWithDesign"]=async args=>{
  if(args.snapshot!==false||args.design!==undefined)
   throw new Error("Customized artwork needs the canonical design-snapshot service before it can be added to cart");
  return addToCart(args.productId,args.digitalType,args.printType,args.format,args.size,
   args.material,args.frame,args.license,args.quantity);
 };
 const removeFromCart:CartContextType["removeFromCart"]=async(productId)=>{
  const id=await requireStore();
  const current=await getStoreCart(id);
  const variants=current.items.filter(item=>item.productId===productId).map(item=>item.variantId);
  setLoadingAdd(true);
  try{for(const variantId of variants)await setStoreVariantQuantity(id,variantId,0);
   await refreshCart();
  }finally{setLoadingAdd(false)}
 };
 const updateCart:CartContextType["updateCart"]=async({productId,printVariantId,digitalVariantId,updates})=>{
  // Legacy arbitrary configuration changes are NOT canonical variants and cannot
  // be repriced or written into the cart. Only explicit quantity updates are safe.
  const keys=Object.keys(updates);
  if(keys.some(key=>key!=="quantity"&&key!=="cartQuantity")||keys.length!==1)
   throw new Error("Select a published product variant; custom option updates are not yet supported");
  const quantity=updates[keys[0]];
  if(typeof quantity!=="number"||!Number.isSafeInteger(quantity)||quantity<0||quantity>20)
   throw new Error("Invalid quantity");
  const id=await requireStore();
  const current=await getStoreCart(id);
  const requested=digitalVariantId&&digitalVariantId!=="ADD"&&digitalVariantId!=="REMOVE"?digitalVariantId:
   printVariantId&&printVariantId!=="ADD"&&printVariantId!=="REMOVE"?printVariantId:null;
  const matches=current.items.filter(item=>item.productId===productId&&(!requested||item.variantId===requested));
  if(matches.length!==1)throw new Error("Select an exact cart variant to update");
  await setStoreVariantQuantity(id,matches[0].variantId,quantity);
  await refreshCart();
 };
 const cart=quote?projectLegacyCart(quote):[];
 const totalPrice=cart.reduce((sum,item)=>sum+item.cartPrice*item.cartQuantity,0);
 return <Context.Provider value={{cart,loadingCart,loadingAdd,totalPrice,
  refreshCart,addToCart,addToCartWithDesign,removeFromCart,updateCart}}>{children}</Context.Provider>;
}
