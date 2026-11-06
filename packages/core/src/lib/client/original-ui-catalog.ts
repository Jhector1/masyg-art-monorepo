import type {PublicCatalogItem,PublicVariant} from "../public-catalog-view";
import {catalogMediaPath,formatCatalogPrice} from "../public-catalog-view";
import type {CartQuote} from "./storefront-commerce";
import type {CartSelectedItem} from "../../types";

/** Historical ZileDigital Gallery visual props, projected from verified catalog/quote. */
export type OriginalGalleryItem = {
  canonical:true;
  id:string; canonicalSlug:string; title:string; thumbnails:string[];
  price:number; priceMinor:number; compareAtMinor:number|null; currency:string;
  available:boolean; kind:string;
  cartItemId?:string; cartQuantity?:number; originalPrice?:number;
  digital?:{id:string}|null; print?:{id:string; attributes?:Record<string,string>}|null; previewUrl?:string|null;
  selection?:Record<string,string>;
};
function major(minor:number,currency:string):number {
  if(!Number.isSafeInteger(minor)||minor<0)throw new Error("Invalid monetary amount");
  const digits=new Intl.NumberFormat("en-US",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2;
  return minor/(10**digits);
}
function attrs(variant:PublicVariant):Record<string,unknown> {
  return variant.attributes&&typeof variant.attributes==="object"&&!Array.isArray(variant.attributes)
    ?variant.attributes as Record<string,unknown>:{};
}
export function hasCatalogKind(item:PublicCatalogItem,variant:PublicVariant,kind:string) {
  if(kind==="ALL")return true;
  if(item.product.categories?.some(c=>c.toUpperCase()===kind))return true;
  const a=attrs(variant);
  return [a.kind,a.productKind,a.category].some(v=>typeof v==="string"&&v.toUpperCase()===kind);
}
export function projectOriginalGalleryItem(storeId:string,item:PublicCatalogItem,variant:PublicVariant):OriginalGalleryItem {
  if(!item.product.variants.some(v=>v.id===variant.id))throw new Error("Variant is not in listing");
  const media=item.product.publicMedia[0];
  return {
    canonical:true,id:item.product.id,canonicalSlug:item.slug,title:item.product.title,
    thumbnails:media?[catalogMediaPath(storeId,media.assetId)]:[],
    price:major(variant.priceMinor,variant.currency),priceMinor:variant.priceMinor,
    compareAtMinor:variant.compareAtMinor,currency:variant.currency,
    available:variant.available,kind:String(attrs(variant).kind??item.product.categories?.[0]??"ART"),
  };
}
/** Cart rows are display-only. The browser never chooses the unit price. */
export function projectOriginalCartItems(quote:CartQuote,storeId:string,listings:PublicCatalogItem[]):OriginalGalleryItem[] {
  const byProduct=new Map(listings.map(item=>[item.product.id,item]));
  return quote.items.map(line=>{
    const item=byProduct.get(line.productId);
    const media=item?.product.publicMedia[0];
    const unit=major(line.unitPriceMinor,line.currency);
    return {
      canonical:true,id:line.productId,canonicalSlug:item?.slug??"",title:line.title,
      thumbnails:media?[catalogMediaPath(storeId,media.assetId)]:[],
      price:unit,priceMinor:line.unitPriceMinor,compareAtMinor:null,currency:line.currency,
      available:line.available,kind:"ART",cartItemId:line.variantId,cartQuantity:line.quantity,
      originalPrice:unit,
      digital:line.fulfillment==="DIGITAL"?{id:line.variantId}:null,
      print:line.fulfillment==="PHYSICAL"?{id:line.variantId,attributes:line.selection??{}}:null,
      selection:line.selection,
    };
  });
}
/** Never format a price from client-entered customization selections. */
export function originalGalleryMoney(minor:number,currency:string) {return formatCatalogPrice(minor,currency);}


/** Read-only view model for historical Gallery cart cards. Never feeds checkout. */
export function cartGalleryPresentation(item:CartSelectedItem|OriginalGalleryItem) {
  let price:number;
  let compareAt:number|null;
  if("cartPrice" in item){
    price=item.cartPrice;
    compareAt=Number.isFinite(item.originalPrice)&&item.originalPrice>price
      ?item.originalPrice:null;
  }else{
    price=item.price;
    compareAt=item.compareAtMinor!==null&&item.compareAtMinor>item.priceMinor
      ?major(item.compareAtMinor,item.currency):null;
  }
  if(!Number.isFinite(price)||price<0)throw new Error("Invalid cart display price");
  // Neither the new persisted ProductVariant nor the canonical cart projection
  // stores `print.frame` / `print.material` as legacy direct properties.
  const print=item.print;
  const raw=print && "attributes" in print ? print.attributes : null;
  const attributes=raw&&typeof raw==="object"&&!Array.isArray(raw)
    ?raw as Record<string,unknown>:null;
  const rawFrame=attributes?.frame;
  const rawMaterial=attributes?.material;
  // Frames can only render their locally bundled preview asset when the
  // metadata is a safe, simple label. Missing metadata is not invented.
  const frame=typeof rawFrame==="string"&&/^[A-Za-z0-9][A-Za-z0-9 -]{0,47}$/.test(rawFrame)
    ?rawFrame:null;
  const material=typeof rawMaterial==="string"&&rawMaterial.length<=80
    ?rawMaterial:null;
  const selection="selection" in item?item.selection:null;
  return {price,compareAt,frame,material,selection};
}
