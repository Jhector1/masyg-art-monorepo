import { getOfferingDefinition, suggestedOfferings, conservativeExistingOffering,
  groupOfferings, assertOfferingFulfillment } from "./universal-offerings";

describe("universal catalog foundation (not checkout-enabled)", () => {
  it("keeps editor templates independent of stored purchase permissions", () => {
    expect(suggestedOfferings("ARTWORK")).toEqual(["PRINT", "DOWNLOAD"]);
    expect(suggestedOfferings("REGULAR_ITEM")).toEqual(["MERCHANDISE"]);
    expect(suggestedOfferings("BLANK")).toEqual([]);
  });
  it("separates physical and digital fulfillment", () => {
    expect(getOfferingDefinition("DOWNLOAD").requiresPrivateFile).toBe(true);
    expect(getOfferingDefinition("PRINT").fulfillment).toBe("PHYSICAL");
    expect(() => assertOfferingFulfillment("DOWNLOAD", "PHYSICAL")).toThrow();
  });
  it("never guesses prints from a generic coffee bag's size attribute", () => {
    expect(conservativeExistingOffering("PHYSICAL")).toBe("MERCHANDISE");
    expect(conservativeExistingOffering("DIGITAL")).toBe("DOWNLOAD");
  });
  it("groups explicit original/print/download without losing variant identity", () => {
    const groups = groupOfferings([
      {id:"download-1",fulfillment:"DIGITAL" as const,offeringKind:"DOWNLOAD" as const},
      {id:"print-1",fulfillment:"PHYSICAL" as const,offeringKind:"PRINT" as const},
      {id:"original-1",fulfillment:"PHYSICAL" as const,offeringKind:"ORIGINAL" as const},
    ]);
    expect(groups.map(g => g.kind)).toEqual(["DOWNLOAD", "ORIGINAL", "PRINT"]);
    expect(groups.flatMap(g => g.variants).length).toBe(3);
  });
  it("rejects duplicate IDs and contradictory fulfillment", () => {
    expect(() => groupOfferings([{id:"x",fulfillment:"DIGITAL" as const},{id:"x",fulfillment:"DIGITAL" as const}])).toThrow();
    expect(() => groupOfferings([{id:"x",fulfillment:"PHYSICAL" as const,offeringKind:"DOWNLOAD" as const}])).toThrow();
  });
});
