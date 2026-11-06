import {
  availablePublicVariantById, isPublicPrintVariant, publicPrintSize,
  publicPrintVariantLabel, sortedPublicPrintVariants,
} from "./public-print-variants";
import {isPublicOriginal, type PublicVariant} from "./public-catalog-view";

function v(id: string, overrides: Partial<PublicVariant> = {}): PublicVariant {
  return {id, name: "Edition", attributes: {size:"8 × 10 in"}, fulfillment:"PHYSICAL",
    offeringKind:"PRINT",priceMinor:2500,compareAtMinor:null,currency:"USD",available:true,...overrides};
}

describe("v39D.4 public print buyer contract", () => {
  test("only explicitly classified physical offerings are prints", () => {
    expect(isPublicPrintVariant(v("print"))).toBe(true);
    expect(isPublicPrintVariant(v("coffee",{offeringKind:"MERCHANDISE"}))).toBe(false);
    expect(isPublicPrintVariant(v("legacy",{offeringKind:null}))).toBe(false);
    expect(isPublicPrintVariant(v("digital",{fulfillment:"DIGITAL"}))).toBe(false);
  });
  test("originals are classified by offering before legacy metadata", () => {
    expect(isPublicOriginal(v("original",{offeringKind:"ORIGINAL", attributes:{}}))).toBe(true);
    expect(isPublicOriginal(v("not-original",{offeringKind:"PRINT",attributes:{original:true}}))).toBe(false);
    expect(isPublicOriginal(v("legacy-original",{offeringKind:null,attributes:{original:true}}))).toBe(true);
    expect(isPublicOriginal(v("backfilled-original",{offeringKind:"MERCHANDISE",attributes:{original:true}}))).toBe(true);
  });
  test("reads real merchant size labels, inches and centimeters", () => {
    expect(publicPrintSize(v("a"))?.areaCm2).toBeCloseTo(516.128,2);
    expect(publicPrintSize(v("b",{attributes:{size:"20 x 30 cm"}}))?.areaCm2).toBe(600);
    expect(publicPrintSize(v("c",{attributes:{size:"16 × 203 in"}}))?.label).toBe("16 × 203 in");
  });
  test("does not infer print size from an arbitrary string or missing attributes", () => {
    expect(publicPrintSize(v("a",{attributes:{size:"XL"}}))).toBeNull();
    expect(publicPrintSize(v("a",{attributes:null}))).toBeNull();
    expect(publicPrintSize(v("a",{attributes:{size:"0 × 10 in"}}))).toBeNull();
    expect(publicPrintSize(v("a",{attributes:{size:"1.2345 × 10 in"}}))).toBeNull();
  });
  test("displays each real print configuration as one distinct priced variant", () => {
    const matte=v("matte",{attributes:{size:"11 × 14 in",material:"Cotton Rag",finish:"Matte",frame:"Unframed",glazing:"None"}});
    const glossy=v("glossy",{attributes:{size:"11 × 14 in",material:"Cotton Rag",finish:"Glossy"},priceMinor:4200});
    expect(publicPrintVariantLabel(matte)).toBe("11 × 14 in · Cotton Rag · Matte");
    expect(publicPrintVariantLabel(glossy)).toBe("11 × 14 in · Cotton Rag · Glossy");
    expect(glossy.priceMinor).toBe(4200);
  });
  test("does not invent size when a classified print has missing metadata", () => {
    expect(publicPrintVariantLabel(v("p",{name:"Limited print",attributes:{}}))).toBe("Limited print");
  });
  test("sorts actual prints by area even with different units; other items keep their slots", () => {
    const original=v("orig",{offeringKind:"ORIGINAL"});
    const big=v("big",{attributes:{size:"16 × 20 in"}});
    const small=v("small",{attributes:{size:"8 × 10 in"}});
    const mid=v("mid",{attributes:{size:"20 × 30 cm"}});
    const digital=v("dig",{offeringKind:"DOWNLOAD",fulfillment:"DIGITAL"});
    expect(sortedPublicPrintVariants([original,big,small,digital,mid]).map(x=>x.id))
      .toEqual(["orig","small","mid","dig","big"]);
  });
  test("unavailable prints remain visible but cannot be selected for cart", () => {
    const soldOut=v("sold",{available:false});
    const available=v("ok");
    expect(sortedPublicPrintVariants([soldOut,available])).toHaveLength(2);
    expect(availablePublicVariantById([soldOut,available],"sold")).toBeNull();
    expect(availablePublicVariantById([soldOut,available],"ok")?.id).toBe("ok");
    expect(availablePublicVariantById([soldOut,available],"other")).toBeNull();
  });
  test("never merges two variants merely because their dimensions match", () => {
    const a=v("a",{priceMinor:2000});
    const b=v("b",{priceMinor:3000});
    const result=sortedPublicPrintVariants([b,a]);
    expect(result.map(x=>x.id)).toEqual(["a","b"]);
    expect(result.map(x=>x.priceMinor)).toEqual([2000,3000]);
  });
  test("does not use size heuristics to reclassify merchandise", () => {
    const coffee=v("coffee",{offeringKind:"MERCHANDISE",attributes:{size:"8 × 10 in"}});
    expect(publicPrintSize(coffee)).toBeNull();
    expect(publicPrintVariantLabel(coffee)).toBe(coffee.name);
  });
});
