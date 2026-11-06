import { orderedGalleryIds } from "./merchant-gallery-order";
describe("canonical gallery ordering", () => {
  it("allows cover selection and deterministic thumbnail ordering", () => {
    expect(orderedGalleryIds(["assetB", "assetA"], ["assetA", "assetB"])).toEqual(["assetB", "assetA"]);
  });
  it("rejects duplicated asset IDs and foreign IDs", () => {
    expect(() => orderedGalleryIds(["assetA", "assetA"], ["assetA", "assetB"])).toThrow();
    expect(() => orderedGalleryIds(["assetA", "otherId"], ["assetA", "assetB"])).toThrow();
  });
  it("rejects stale order and malformed input", () => {
    expect(() => orderedGalleryIds(["assetA"], ["assetA", "assetB"])).toThrow();
    expect(() => orderedGalleryIds(["a/b"], ["a/b"])).toThrow();
    expect(() => orderedGalleryIds(new Array(51).fill("assetA"), new Array(51).fill("assetA"))).toThrow();
  });
});
