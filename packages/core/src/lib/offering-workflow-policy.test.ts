import { eligibleOfferingKinds, offeringMatchesFulfillment, validateOfferingName } from "./offering-workflow-policy";

test("digital offerings only accept digital variants", () => {
  expect(offeringMatchesFulfillment("DOWNLOAD", "DIGITAL")).toBe(true);
  expect(offeringMatchesFulfillment("DOWNLOAD", "PHYSICAL")).toBe(false);
  expect(eligibleOfferingKinds("DIGITAL")).toEqual(["DOWNLOAD"]);
});
test("originals, prints and merchandise share physical fulfillment", () => {
  expect(eligibleOfferingKinds("PHYSICAL")).toEqual(["ORIGINAL", "PRINT", "MERCHANDISE"]);
  for (const kind of eligibleOfferingKinds("PHYSICAL")) {
    expect(offeringMatchesFulfillment(kind, "PHYSICAL")).toBe(true);
    expect(offeringMatchesFulfillment(kind, "DIGITAL")).toBe(false);
  }
});
test("invalid names rejected rather than silently truncated", () => {
  expect(validateOfferingName("  Archival fine art print ")).toBe("Archival fine art print");
  expect(() => validateOfferingName(" ")).toThrow();
  expect(() => validateOfferingName("x".repeat(101))).toThrow();
});
