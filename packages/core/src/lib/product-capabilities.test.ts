import {getDisplayKind,getFulfillmentCapabilities,getVariantStringAttribute} from "./product-capabilities";
test("presentation kind comes only from explicit canonical metadata", () => {
  expect(getDisplayKind({category:"ART",variants:[]})).toBe("ART");
  expect(getDisplayKind({category:"Paintings",variants:[{fulfillment:"PHYSICAL",attributes:{productKind:"STICKER"}}]})).toBe("STICKER");
  expect(getDisplayKind({category:"Unknown",variants:[]})).toBe("OTHER");
});
test("availability is not guessed from an editorial kind", () => {
  expect(getFulfillmentCapabilities({variants:[{fulfillment:"PHYSICAL",active:true}]})).toEqual({supportsDigital:false,supportsPrint:true});
  expect(getFulfillmentCapabilities({variants:[{fulfillment:"DIGITAL",active:false}]})).toEqual({supportsDigital:false,supportsPrint:false});
});
test("optional variant attributes are validated before display", () => {
  expect(getVariantStringAttribute({attributes:{frame:"Walnut"}},"frame")).toBe("Walnut");
  expect(getVariantStringAttribute({attributes:["Wood"]},"frame")).toBeNull();
});
