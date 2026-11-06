import { getPublicProduct } from "./public-catalog";
import { catalogMediaPath, isPublicOriginal, type PublicVariant } from "./public-catalog-view";

function attrsOf(variant: PublicVariant): Record<string, unknown> {
  const raw=variant.attributes;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string,unknown> : {};
}
function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length <= 120 ? value : null;
}
/** Catalog-only studio read. All media is published; personal designs and cart writes are separate capabilities. */
export async function getPublishedStudioProduct(storeId:string,slug:string) {
  const detail=await getPublicProduct({storeId,slug});
  const media=detail.product.publicMedia.map(item=>catalogMediaPath(storeId,item.assetId));
  const variants=detail.product.variants.map(variant=>{
    const attrs=attrsOf(variant);
    const kind=variant.fulfillment==="DIGITAL"?"DIGITAL":isPublicOriginal(variant)?"ORIGINAL":"PRINT";
    return {
      id:variant.id, name:variant.name, fulfillment:variant.fulfillment,
      type:kind, attributes:variant.attributes, currency:variant.currency,
      priceMinor:variant.priceMinor, available:variant.available,
      size:optionalText(attrs.size),format:optionalText(attrs.format),
      material:optionalText(attrs.material),frame:optionalText(attrs.frame),
      inUserCart:false, // Anonymous published read cannot assert a buyer's cart.
    };
  });
  const firstPrice=variants.length?Math.min(...variants.map(v=>v.priceMinor)):0;
  const firstCurrency=variants[0]?.currency ?? "USD";
  const sizes=Array.from(new Set(variants.map(v=>v.size).filter((s):s is string=>Boolean(s))));
  const formats=Array.from(new Set(variants.map(v=>v.format).filter((s):s is string=>Boolean(s))));
  return {
    id:detail.product.id,slug, title:detail.product.title,description:detail.product.description,
    imageUrl:media[0]??"",thumbnails:media,variants,
    availableFulfillment:Array.from(new Set(variants.map(v=>v.fulfillment))),
    requiresShipping:variants.some(v=>v.fulfillment==="PHYSICAL"),
    currency:firstCurrency,priceMinor:firstPrice,
    // Legacy studio price labels are display-only; never submit this price to checkout.
    price:firstCurrency==="USD"?firstPrice/100:0,
    kind:"ART",category:"",sizes,formats,svgPreview:"",
    salePercent:0,salePrice:0,saleStartsAt:"",saleEndsAt:"",
    originalVariant:variants.find(v=>v.type==="ORIGINAL")??null,
    printVariants:variants.filter(v=>v.type==="PRINT"),
    digitalVariants:variants.filter(v=>v.type==="DIGITAL"),
    userDesign:null,userDesignPreviewUrl:null, reviews:[],
    studioPurchasingEnabled:false,
  };
}
