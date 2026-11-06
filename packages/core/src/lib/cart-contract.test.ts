import { assessVariant, guestCartAddInput, guestCartSetInput, quoteLines } from "./cart-contract";
const v = (overrides:Record<string,unknown>={}) => ({
  id:"variant_001",name:"Print",fulfillment:"PHYSICAL" as const,inventoryPolicy:"TRACKED" as const,
  priceMinor:1299,currency:"USD",active:true,inventory:[{onHand:5,reserved:2}],digitalFiles:[],
  product:{id:"prod_001",title:"Original art",status:"PUBLISHED" as const,listings:[{status:"PUBLISHED" as const}]},
  ...overrides,
});
test("rejects client prices and unbounded quantities",()=>{
  expect(()=>guestCartAddInput.parse({variantId:"variant_001",quantity:2,priceMinor:0})).toThrow();
  expect(()=>guestCartAddInput.parse({variantId:"variant_001",quantity:21})).toThrow();
  expect(guestCartSetInput.parse({variantId:"variant_001",quantity:0}).quantity).toBe(0);
});
test("server computes minor-unit totals",()=>{
  const q=quoteLines([{quantity:2,variant:v()}]);
  expect(q.subtotalMinor).toBe(2598);
  expect(q.currency).toBe("USD");
  expect(quoteLines([]).currency).toBeNull();
  expect(q.readyForCheckout).toBe(false);
  expect(q.issues).toEqual([]);
});
test("unpublished and inventory-limited lines cannot be offered as ready",()=>{
  expect(assessVariant(v(),4)).toBe("OUT_OF_STOCK");
  expect(assessVariant(v({product:{id:"prod_001",title:"Art",status:"DRAFT",listings:[]}}),1)).toBe("UNPUBLISHED");
});
test("digital variants require protected files",()=>{
  expect(assessVariant(v({fulfillment:"DIGITAL",inventoryPolicy:"UNLIMITED"}),1)).toBe("FILE_UNAVAILABLE");
  expect(assessVariant(v({fulfillment:"DIGITAL",inventoryPolicy:"UNLIMITED",digitalFiles:[{id:"file_01"}]}),1)).toBeNull();
});
test("mixed currencies cannot proceed as one charge",()=>{
  const q=quoteLines([{quantity:1,variant:v()},{quantity:1,variant:v({id:"variant_002",currency:"EUR"})}]);
  expect(q.issues).toContainEqual({variantId:"variant_002",code:"MIXED_CURRENCY"});
});
test("rejects overflow totals",()=>{
  expect(()=>quoteLines([{quantity:20,variant:v({priceMinor:Number.MAX_SAFE_INTEGER})}])).toThrow();
});
test("server rejects a license variant that does not match merchant product opt-in",()=>{
  const licensed={license:"commercial"};
  const digital={fulfillment:"DIGITAL" as const,inventoryPolicy:"UNLIMITED" as const,
    digitalFiles:[{id:"file_01"}],attributes:licensed};
  expect(assessVariant(v({...digital,product:{...v().product,offersDigitalLicenses:false}}),1)).toBeNull();
  expect(assessVariant(v({...digital,product:{...v().product,offersDigitalLicenses:true}}),1)).toBeNull();
  expect(assessVariant(v({...digital,attributes:{format:"SVG"},product:{...v().product,offersDigitalLicenses:true}}),1)).toBe("LICENSE_NOT_OFFERED");
});


test("fixed framed or glazed physical SKU stays sellable without optional selectors",()=>{
 const attributes={frame:"Black wood",glazing:"UV acrylic"};
 expect(assessVariant(v({attributes}),1)).toBeNull();
 expect(assessVariant(v({attributes,product:{...v().product,offersFraming:true}}),1)).toBeNull();
 expect(assessVariant(v({attributes,product:{...v().product,offersFraming:true,offersGlazing:true}}),1)).toBeNull();
 const q=quoteLines([{quantity:1,variant:v({attributes,product:{...v().product,offersFraming:true,offersGlazing:true}})}]);
 expect(q.items[0].unitPriceMinor).toBe(1299);
 expect(q.items[0].selection).toEqual(attributes);
});
