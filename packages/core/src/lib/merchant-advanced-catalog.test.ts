import { catalogVariantInput, variantPatchInput } from "./catalog-contract";

describe("v30 artwork variant and regular price contracts", () => {
  const base = { name: "Canvas print", fulfillment: "PHYSICAL", currency: "USD", priceMinor: 1200 };
  it("accepts edition, material and display-only regular price", () => {
    const parsed = catalogVariantInput.parse({ ...base, compareAtMinor: 1800,
      attributes: { size: "18 × 24 in", material: "Canvas", format: "Print", finish: "Matte", edition: "2 of 50" },
    });
    expect(parsed.compareAtMinor).toBe(1800);
    expect(parsed.attributes?.edition).toBe("2 of 50");
  });
  it("refuses markdowns with regular price below or equal to selling price", () => {
    for (const compareAtMinor of [1200, 1199, 0, -3, 1.2]) {
      expect(catalogVariantInput.safeParse({ ...base, compareAtMinor }).success).toBe(false);
    }
  });
  it("does not permit client-controlled money in artwork JSON", () => {
    expect(catalogVariantInput.safeParse({ ...base, attributes: { salePrice: 2 } }).success).toBe(false);
  });
  it("supports explicit clearing of regular price and SKU", () => {
    expect(variantPatchInput.parse({ compareAtMinor: null, sku: null })).toEqual({ compareAtMinor: null, sku: null });
  });
  it("rejects legacy global site fields", () => {
    expect(catalogVariantInput.safeParse({ ...base, site: "ZILEDIGITAL" }).success).toBe(false);
  });
});
