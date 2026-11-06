import {hasCatalogKind,projectOriginalGalleryItem,projectOriginalCartItems,cartGalleryPresentation} from "./original-ui-catalog";
import type {PublicCatalogItem} from "../public-catalog-view";
import type {CartQuote} from "./storefront-commerce";
const product:PublicCatalogItem={
 slug:"haitian-art-print",product:{id:"prod1",title:"Haitian Art Print",description:"description",categories:["ART"],
 publicMedia:[{assetId:"media1",altText:"Art",mimeType:"image/png"}],
 variants:[{id:"var1",name:"Standard",attributes:{kind:"ART"},fulfillment:"PHYSICAL",priceMinor:1200,
 compareAtMinor:null,currency:"USD",available:false}]}
};
test("main gallery uses canonical product identity but listing slug for navigation",()=>{
 const rendered=projectOriginalGalleryItem("store1",product,product.product.variants[0]);
 expect(rendered.id).toBe("prod1");expect(rendered.canonicalSlug).toBe("haitian-art-print");
 expect(rendered.price).toBe(12);expect(rendered.available).toBe(false);
 expect(rendered.thumbnails[0]).toContain("/api/public/stores/store1/media/media1");
});
test("category and variant kind are from published catalog",()=>{
 expect(hasCatalogKind(product,product.product.variants[0],"ART")).toBe(true);
 expect(hasCatalogKind(product,product.product.variants[0],"MUG")).toBe(false);
});
test("original cart renders server quote and keeps exact variant ID for removal",()=>{
 const quote:CartQuote={items:[{variantId:"var1",productId:"prod1",title:"Haitian Art Print",variantName:"Standard",
  fulfillment:"PHYSICAL",quantity:2,unitPriceMinor:1200,lineMinor:2400,currency:"USD",available:true}],
  currency:"USD",subtotalMinor:2400,issues:[],readyForCheckout:false,note:""};
 const result=projectOriginalCartItems(quote,"store1",[product]);
 expect(result[0].cartItemId).toBe("var1");expect(result[0].cartQuantity).toBe(2);
 expect(result[0].priceMinor).toBe(1200);expect(result[0].price).toBe(12);
 expect(result[0].canonicalSlug).toBe(product.slug);
});
test("variant not in canonical listing is refused",()=>{
 expect(()=>projectOriginalGalleryItem("store1",product,{...product.product.variants[0],id:"foreign"})).toThrow();
});

test("canonical cart Gallery price is the quoted minor-unit amount, not a legacy price field",()=>{
 const quote:CartQuote={items:[{variantId:"var1",productId:"prod1",title:"Haitian Art Print",variantName:"Standard",
  fulfillment:"PHYSICAL",quantity:2,unitPriceMinor:1200,lineMinor:2400,currency:"USD",available:true}],
  currency:"USD",subtotalMinor:2400,issues:[],readyForCheckout:false,note:""};
 const row=projectOriginalCartItems(quote,"store1",[product])[0];
 expect(cartGalleryPresentation(row)).toEqual({price:12,compareAt:null,frame:null,material:null});
});
test("historical cart card reads print labels only from typed variant attributes",()=>{
 const row={cartPrice:12,originalPrice:15,print:{attributes:{frame:"Black",material:"Canvas"}}};
 const display=cartGalleryPresentation(row as unknown as import("../../types").CartSelectedItem);
 expect(display).toEqual({price:12,compareAt:15,frame:"Black",material:"Canvas"});
 const bad={cartPrice:12,originalPrice:10,print:{attributes:{frame:"../../secret",material:24}}};
 expect(cartGalleryPresentation(bad as unknown as import("../../types").CartSelectedItem)).toEqual({
   price:12,compareAt:null,frame:null,material:null,
 });
});
