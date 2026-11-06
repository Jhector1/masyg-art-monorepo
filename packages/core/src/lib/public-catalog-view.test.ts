import { catalogMediaPath, formatCatalogPrice, isPublicOriginal, visibleVariants, type PublicVariant } from "./public-catalog-view";

const variant = (attrs: unknown, fulfillment: "PHYSICAL" | "DIGITAL" = "PHYSICAL"): PublicVariant => ({
  id: "v_123", name: "Edition", attributes: attrs, fulfillment, priceMinor: 4500,
  compareAtMinor: null, currency: "USD", available: true,
});
test("original must be explicitly marked and physically fulfilled", () => {
  expect(isPublicOriginal(variant({edition: "ORIGINAL"}))).toBe(true);
  expect(isPublicOriginal(variant({original: true}))).toBe(true);
  expect(isPublicOriginal(variant({edition: "ORIGINAL"}, "DIGITAL"))).toBe(false);
  expect(isPublicOriginal(variant({kind: "ART"}))).toBe(false);
  expect(isPublicOriginal(variant(null))).toBe(false);
});
test("original-only filters do not relabel every physical item as unique", () => {
  const item = {slug: "a", product:{id:"p",title:"A",description:"",publicMedia:[],variants:[
    variant({kind:"MUG"}), variant({original:true}), variant({format:"PDF"},"DIGITAL"),
  ]}};
  expect(visibleVariants(item,"ORIGINAL")).toHaveLength(1);
  expect(visibleVariants(item)).toHaveLength(3);
});
test("public media URL uses scoped server route, never private storage paths", () => {
  expect(catalogMediaPath("store_123", "asset_123")).toBe("/api/public/stores/store_123/media/asset_123");
  expect(catalogMediaPath("store/other", "asset?wrong")).not.toContain("?wrong");
});
test("display prices are based on minor units without rounding mistakes", () => {
  expect(formatCatalogPrice(12345,"USD")).toBe("$123.45");
  expect(formatCatalogPrice(-1,"USD")).toBe("Price unavailable");
  expect(formatCatalogPrice(3500,"JPY")).toBe("¥3,500");
});
