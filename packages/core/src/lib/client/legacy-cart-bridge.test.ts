import {projectLegacyCart,uniquePublishedVariant,assertOrdinaryCartSelection} from "./legacy-cart-bridge";
import type {CartQuote,PublicStoreProduct} from "./storefront-commerce";

const quote:CartQuote={items:[{variantId:"variant_123",productId:"prod_001",title:"Art",variantName:"Standard",
  fulfillment:"PHYSICAL",quantity:2,unitPriceMinor:1200,lineMinor:2400,currency:"USD",available:true}],
  currency:"USD",subtotalMinor:2400,issues:[],readyForCheckout:false,note:"Preview"};
test("legacy cart count and price come exclusively from canonical server quote",()=>{
 const [line]=projectLegacyCart(quote);
 expect(line.id).toBe("prod_001");
 expect(line.cartItemId).toBe("variant_123");
 expect(line.cartQuantity).toBe(2);
 expect(line.cartPrice).toBe(12);
 expect(line.print?.id).toBe("variant_123");
 expect(line.digital).toBeNull();
});
test("unavailable or ambiguous variants never silently pick a different SKU",()=>{
 const listing={product:{variants:[{id:"one",available:true,fulfillment:"DIGITAL"},{id:"two",available:true,fulfillment:"DIGITAL"}]}} as unknown as PublicStoreProduct;
 expect(()=>uniquePublishedVariant(listing,"DIGITAL")).toThrow(/exact available variant/);
 expect(()=>uniquePublishedVariant(listing,"PHYSICAL")).toThrow();
});
test("custom designs and mixed fulfillment are not silently sold as plain cart items",()=>{
 expect(()=>assertOrdinaryCartSelection({digitalType:"Digital",printType:null,design:{previewDataUrl:"data:image/png"}})).toThrow(/design-snapshot/);
 expect(()=>assertOrdinaryCartSelection({digitalType:"Digital",printType:"Print"})).toThrow(/one/);
 expect(()=>assertOrdinaryCartSelection({digitalType:"Digital",printType:null})).not.toThrow();
});
test("legacy option labels cannot silently overwrite the published variant",()=>{
 const {assertRepresentedSelection}=require("./legacy-cart-bridge") as typeof import("./legacy-cart-bridge");
 const variant={id:"variant_123",name:"Standard",available:true,fulfillment:"PHYSICAL",attributes:{size:"12x18"}} as unknown as import("./storefront-commerce").PublicVariant;
 expect(()=>assertRepresentedSelection(variant,{format:"",size:"24x36",material:null,frame:null,license:""})).toThrow(/Selected size/);
 expect(()=>assertRepresentedSelection(variant,{format:"",size:"12x18",material:null,frame:null,license:""})).not.toThrow();
 expect(()=>assertRepresentedSelection(variant,{format:"PNG",size:null,material:null,frame:null,license:""})).toThrow(/Selected format/);
});
