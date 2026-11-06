import { availablePublicPrintChoice, publicPrintChoices } from "./public-print-choices";
import type { PublicVariant } from "./public-catalog-view";

function variant(id: string, kind: PublicVariant["offeringKind"], size: string, priceMinor: number,
  extra: Partial<PublicVariant> = {}): PublicVariant {
  return {
    id, name: `Edition ${id}`, fulfillment: "PHYSICAL", offeringKind: kind,
    attributes: {size, material: "Cotton rag", frame: "Unframed"},
    priceMinor, compareAtMinor: null, currency: "USD", available: true, ...extra,
  };
}

describe("ZileDigital canonical published print choices", () => {
  test("shows real print variants only, sorted by physical area", () => {
    const items = [
      variant("large", "PRINT", "16 x 20 in", 6500),
      variant("original", "ORIGINAL", "8 x 10 in", 90000),
      variant("small", "PRINT", "8 x 10 in", 2500),
      variant("shirt", "MERCHANDISE", "8 x 10 in", 2000),
    ];
    expect(publicPrintChoices(items).map(choice => choice.variantId)).toEqual(["small", "large"]);
    expect(publicPrintChoices(items).map(choice => choice.priceLabel)).toEqual(["$25.00", "$65.00"]);
  });

  test("never collapses two stocked editions with identical print dimensions", () => {
    const items = [variant("first", "PRINT", "8 x 10 in", 2500),
      variant("second", "PRINT", "8 x 10 in", 3000)];
    const choices = publicPrintChoices(items);
    expect(choices).toHaveLength(2);
    expect(choices[0].variantId).not.toBe(choices[1].variantId);
    expect(choices[0].label).not.toBe(choices[1].label);
    expect(choices.map(item => item.priceLabel)).toEqual(["$25.00", "$30.00"]);
  });

  test("unavailable prints remain visible but cannot be chosen", () => {
    const soldOut = variant("soldout", "PRINT", "11 x 14 in", 4000, {available: false});
    expect(publicPrintChoices([soldOut])[0].available).toBe(false);
    expect(availablePublicPrintChoice([soldOut], "soldout")).toBeNull();
  });

  test("rejects original, merchandise, digital, and unknown variant IDs", () => {
    const items = [variant("print", "PRINT", "8 x 10 in", 2500),
      variant("original", "ORIGINAL", "8 x 10 in", 65000),
      variant("goods", "MERCHANDISE", "8 x 10 in", 1200),
      variant("download", "DOWNLOAD", "", 500, {fulfillment: "DIGITAL"})];
    expect(availablePublicPrintChoice(items, "print")?.id).toBe("print");
    expect(availablePublicPrintChoice(items, "original")).toBeNull();
    expect(availablePublicPrintChoice(items, "goods")).toBeNull();
    expect(availablePublicPrintChoice(items, "download")).toBeNull();
    expect(availablePublicPrintChoice(items, "missing")).toBeNull();
  });

  test("uses the merchant's recorded size, never infers an invalid one", () => {
    const item = variant("custom", "PRINT", "surprise", 3800);
    expect(publicPrintChoices([item])[0].sizeLabel).toBeNull();
    expect(publicPrintChoices([item])[0].label).toContain("Edition custom");
  });

  test("independent frame variants retain exact different prices", () => {
    const plain = variant("plain", "PRINT", "8 x 10 in", 2500);
    const framed = variant("framed", "PRINT", "8 x 10 in", 5500,
      {attributes: {size:"8 x 10 in",material:"Cotton rag",frame:"Black wood"}});
    const choices = publicPrintChoices([framed,plain]);
    expect(choices).toHaveLength(2);
    expect(choices.map(item => item.priceLabel).sort()).toEqual(["$25.00", "$55.00"]);
    expect(choices.find(item=>item.variantId==="framed")?.label).toContain("Black wood");
  });
});
