/**
 * ZileDigital universal product-offering policy, phase 1.
 *
 * This module is pure and deliberately does NOT replace the existing catalog
 * tables or decide what the public storefront may sell. It provides a typed
 * contract for the later first-class ProductOffering migration.
 *
 * Category (navigation), authoring template (editor UI), offering (purchase
 * intent), variant (priced SKU) and fulfillment (delivery) are independent.
 */
export type FulfillmentMode = "PHYSICAL" | "DIGITAL";
export type OfferingKind = "ORIGINAL" | "PRINT" | "DOWNLOAD" | "MERCHANDISE";
export type AuthoringTemplate = "REGULAR_ITEM" | "DIGITAL_DOWNLOAD" | "ARTWORK" | "BLANK";

export type OfferingDefinition = Readonly<{
  kind: OfferingKind;
  fulfillment: FulfillmentMode;
  requiresPrivateFile: boolean;
  canTrackInventory: boolean;
}>;

const definitions: Readonly<Record<OfferingKind, OfferingDefinition>> = {
  ORIGINAL: {kind: "ORIGINAL", fulfillment: "PHYSICAL", requiresPrivateFile: false, canTrackInventory: true},
  PRINT: {kind: "PRINT", fulfillment: "PHYSICAL", requiresPrivateFile: false, canTrackInventory: true},
  DOWNLOAD: {kind: "DOWNLOAD", fulfillment: "DIGITAL", requiresPrivateFile: true, canTrackInventory: false},
  MERCHANDISE: {kind: "MERCHANDISE", fulfillment: "PHYSICAL", requiresPrivateFile: false, canTrackInventory: true},
};

export function getOfferingDefinition(kind: OfferingKind): OfferingDefinition {
  const definition = definitions[kind];
  if (!definition) throw new Error("Unsupported product offering");
  return definition;
}

/** Suggestions affect ONLY the merchant editor, never tax/checkout permissions. */
export function suggestedOfferings(template: AuthoringTemplate): readonly OfferingKind[] {
  switch (template) {
    case "REGULAR_ITEM": return ["MERCHANDISE"];
    case "DIGITAL_DOWNLOAD": return ["DOWNLOAD"];
    case "ARTWORK": return ["PRINT", "DOWNLOAD"];
    case "BLANK": return [];
    default: throw new Error("Unsupported editor template");
  }
}

/** No metadata heuristic may treat coffee size as evidence of an art print. */
export function conservativeExistingOffering(fulfillment: FulfillmentMode): OfferingKind {
  if (fulfillment === "DIGITAL") return "DOWNLOAD";
  if (fulfillment === "PHYSICAL") return "MERCHANDISE";
  throw new Error("Unsupported fulfillment kind");
}

/** Hard fulfillment boundary; private downloads cannot be sold as shipping SKUs. */
export function assertOfferingFulfillment(kind: OfferingKind, fulfillment: FulfillmentMode): void {
  if (getOfferingDefinition(kind).fulfillment !== fulfillment) {
    throw new Error("Offering and fulfillment mode conflict");
  }
}

export function groupOfferings<T extends {id: string; fulfillment: FulfillmentMode; offeringKind?: OfferingKind}>(
  variants: readonly T[],
): Array<{kind: OfferingKind; fulfillment: FulfillmentMode; variants: T[]}> {
  const grouped = new Map<OfferingKind, T[]>();
  const seen = new Set<string>();
  for (const variant of variants) {
    if (!variant.id || seen.has(variant.id)) throw new Error("Duplicate or missing variant identity");
    seen.add(variant.id);
    const kind = variant.offeringKind ?? conservativeExistingOffering(variant.fulfillment);
    assertOfferingFulfillment(kind, variant.fulfillment);
    const group = grouped.get(kind) ?? [];
    group.push(variant);
    grouped.set(kind, group);
  }
  return [...grouped].sort(([a],[b]) => a.localeCompare(b)).map(([kind, members]) => ({
    kind, fulfillment: getOfferingDefinition(kind).fulfillment, variants: members,
  }));
}
