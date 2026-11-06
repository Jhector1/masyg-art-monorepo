/** Readable offering labels do not grant any commerce or checkout permissions. */
export const OFFERING_KINDS = ["ORIGINAL", "PRINT", "DOWNLOAD", "MERCHANDISE"] as const;
export type OfferingKindValue = (typeof OFFERING_KINDS)[number];
export type OfferingFulfillment = "DIGITAL" | "PHYSICAL";

export function offeringMatchesFulfillment(kind: OfferingKindValue, fulfillment: OfferingFulfillment): boolean {
  return (kind === "DOWNLOAD") === (fulfillment === "DIGITAL");
}
export function offeringKindLabel(kind: OfferingKindValue): string {
  switch (kind) {
    case "ORIGINAL": return "Original / one-of-a-kind";
    case "PRINT": return "Art print / reproduction";
    case "DOWNLOAD": return "Digital download";
    case "MERCHANDISE": return "Regular physical merchandise";
  }
}
export function eligibleOfferingKinds(fulfillment: OfferingFulfillment): OfferingKindValue[] {
  return OFFERING_KINDS.filter(kind => offeringMatchesFulfillment(kind, fulfillment));
}
export function validateOfferingName(value: string): string {
  const name = value.trim();
  if (name.length < 2 || name.length > 100) throw new Error("Offering name must be 2–100 characters");
  return name;
}
