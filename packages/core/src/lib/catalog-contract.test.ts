import { catalogCreateInput, catalogPatchInput, listingPatchInput } from "./catalog-contract";
test("physical and digital variants in the same catalog product", () => {
  const result = catalogCreateInput.parse({ title: " Art ", variants: [
    { name: " Shipped print ", fulfillment: "PHYSICAL", priceMinor: 6500, currency: "USD" },
    { name: " PDF ", fulfillment: "DIGITAL", priceMinor: 1500, currency: "USD" },
  ] });
  expect(result.title).toBe("Art");
  expect(result.variants.map(v => v.fulfillment)).toEqual(["PHYSICAL", "DIGITAL"]);
});
test("rejects prices that are fractional, negative or unsafe integer", () => {
  for (const priceMinor of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(catalogCreateInput.safeParse({title: "Art", variants: [
      {name:"Digital", fulfillment:"DIGITAL", priceMinor, currency:"USD"},
    ]}).success).toBe(false);
  }
});
test("rejects obsolete legacy product and storefront fields", () => {
  expect(catalogPatchInput.safeParse({ kind: "ART" }).success).toBe(false);
  expect(catalogPatchInput.safeParse({ site: "ZILEDIGITAL" }).success).toBe(false);
  expect(listingPatchInput.safeParse({ status: "PUBLISHED", site: "JEANYVES" }).success).toBe(false);
});

test("license choices require a merchant opt-in and real digital variants", () => {
  const variants = [
    {name:"Personal SVG",fulfillment:"DIGITAL",priceMinor:1000,currency:"USD",attributes:{format:"SVG",license:"personal"}},
    {name:"Commercial SVG",fulfillment:"DIGITAL",priceMinor:4000,currency:"USD",attributes:{format:"SVG",license:"commercial"}},
  ];
  expect(catalogCreateInput.safeParse({title:"Art",offersDigitalLicenses:true,variants}).success).toBe(true);
  expect(catalogCreateInput.safeParse({title:"Art",offersDigitalLicenses:false,variants}).success).toBe(true);
  expect(catalogCreateInput.safeParse({title:"Art",offersDigitalLicenses:true,variants:[variants[0]]}).success).toBe(false);
  expect(catalogCreateInput.safeParse({title:"Art",offersDigitalLicenses:true,variants:[{...variants[0],fulfillment:"PHYSICAL"},variants[1]]}).success).toBe(false);
});


test("physical option groups require real variant choices and reject digital frames",()=>{
  const plain={name:"Unframed",fulfillment:"PHYSICAL",priceMinor:4500,currency:"USD",attributes:{size:"16 x 20",frame:"Unframed",glazing:"None"}};
  const framed={...plain,name:"Framed",priceMinor:7600,attributes:{size:"16 x 20",frame:"Black wood",glazing:"UV acrylic"}};
  expect(catalogCreateInput.safeParse({title:"Art",offersFraming:true,offersGlazing:true,variants:[plain,framed]}).success).toBe(true);
  expect(catalogCreateInput.safeParse({title:"Art",offersFraming:true,variants:[plain]}).success).toBe(false);
  expect(catalogCreateInput.safeParse({title:"Art",offersGlazing:true,variants:[plain]}).success).toBe(false);
  expect(catalogCreateInput.safeParse({title:"Art",variants:[{...plain,fulfillment:"DIGITAL",attributes:{frame:"Black wood"}}]}).success).toBe(false);
});

test("a product can contain one fixed licensed download, but not duplicate tiers",()=>{
 const v={name:"Commercial SVG",fulfillment:"DIGITAL",priceMinor:1000,currency:"USD",attributes:{format:"SVG",license:"commercial"}};
 expect(catalogCreateInput.safeParse({title:"Art",variants:[v]}).success).toBe(true);
 expect(catalogCreateInput.safeParse({title:"Art",variants:[v,{...v,name:"Commercial PNG",attributes:{format:"PNG",license:"commercial"}}]}).success).toBe(false);
 expect(catalogCreateInput.safeParse({title:"Art",offersDigitalLicenses:true,variants:[v,{...v,name:"Personal",attributes:{license:"personal",format:"SVG"}}]}).success).toBe(true);
});
