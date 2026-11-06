import { licenseOf, licensedVariantsReady, licenseAllowed, duplicateLicenseTier } from "./digital-license-policy";
test("only three licensed kinds are valid",()=>{
  expect(licenseOf({license:"commercial"})).toBe("commercial");
  expect(licenseOf({license:"free-form"})).toBeNull();
  expect(licenseOf(null)).toBeNull();
});
test("licensed product requires two active tiers and optionally private files",()=>{
 const v=[{fulfillment:"DIGITAL",active:true,attributes:{license:"personal"},digitalFiles:[{id:"1"}]},
 {fulfillment:"DIGITAL",active:true,attributes:{license:"commercial"},digitalFiles:[{id:"2"}]}];
 expect(licensedVariantsReady(v,true)).toBe(true);
 expect(licensedVariantsReady([{...v[0]},{...v[1],digitalFiles:[]}],true)).toBe(false);
 expect(licensedVariantsReady([{...v[0]},{...v[1],attributes:{license:"personal"}}],false)).toBe(false);
});
test("license opt-in is a server saleability rule, not only a UI toggle",()=>{
 expect(licenseAllowed(false,"DIGITAL",{license:"commercial"})).toBe(true);
 expect(licenseAllowed(true,"DIGITAL",{license:"commercial"})).toBe(true);
 expect(licenseAllowed(true,"DIGITAL",{format:"SVG"})).toBe(false);
 expect(licenseAllowed(false,"DIGITAL",{format:"SVG"})).toBe(true);
 expect(licenseAllowed(false,"PHYSICAL",{size:"10x10"})).toBe(true);
});

test("one license tier per product, even when formats or activation differ", () => {
 const editions=[{id:"one",fulfillment:"DIGITAL",attributes:{license:"commercial",format:"SVG"}},
 {id:"print",fulfillment:"PHYSICAL",attributes:{frame:"Black wood"}}];
 expect(duplicateLicenseTier(editions,"commercial")).toBe(true);
 expect(duplicateLicenseTier(editions,"commercial","one")).toBe(false);
 expect(duplicateLicenseTier(editions,"personal")).toBe(false);
 expect(licenseAllowed(false,"DIGITAL",{license:"invalid"})).toBe(false);
});


test("unsaved licensed editions are checked for duplicate tiers before they receive IDs", () => {
  const drafts = [
    { fulfillment: "DIGITAL", attributes: { license: "commercial", format: "SVG" } },
    { fulfillment: "PHYSICAL", attributes: { frame: "Black wood" } },
  ];
  expect(duplicateLicenseTier(drafts, "commercial")).toBe(true);
  expect(duplicateLicenseTier(drafts, "personal")).toBe(false);
  expect(duplicateLicenseTier(drafts, "commercial", "another-id")).toBe(true);
});
