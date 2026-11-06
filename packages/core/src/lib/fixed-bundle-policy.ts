/**
 * Fixed-bundle preview/validation. NEVER use this alone to reserve stock,
 * grant digital files, create payment amounts or settle orders. Actual bundles
 * will require a SERIALIZABLE tenant-scoped checkout transaction.
 */
const MAX_MINOR = 2_147_483_647;

export class BundlePolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BundlePolicyError";
  }
}

export type TrustedBundleComponent = Readonly<{
  variantId: string;
  organizationId: string;
  storeId: string;
  fulfillment: "PHYSICAL" | "DIGITAL";
  quantity: number;
  currency: string;
  unitPriceMinor: number;
  active: boolean;
  /** InventoryPolicy=UNLIMITED is allowed only if explicitly configured. */
  unlimitedInventory?: boolean;
  availablePhysicalQuantity?: number;
  privateDigitalFileReady?: boolean;
}>;

export type AllocatedBundleComponent = Readonly<{
  variantId: string;
  quantity: number;
  fulfillment: "PHYSICAL" | "DIGITAL";
  baseMinor: number;
  netMinor: number;
  discountMinor: number;
}>;

function whole(value: number, field: string, min = 0): number {
  if (!Number.isSafeInteger(value) || value < min || value > MAX_MINOR) {
    throw new BundlePolicyError("INVALID_AMOUNT", `${field} is outside supported integer bounds`);
  }
  return value;
}

/** Largest-remainder allocation; sum of net amounts always equals fixed price. */
export function previewFixedBundle(args: {
  organizationId: string;
  storeId: string;
  currency: string;
  fixedPriceMinor: number;
  components: readonly TrustedBundleComponent[];
}): {currency: string; regularTotalMinor: number; bundleTotalMinor: number; savingsMinor: number;
     components: readonly AllocatedBundleComponent[]} {
  if (!args.organizationId || !args.storeId || !/^[A-Z]{3}$/.test(args.currency) ||
      args.components.length < 2 || args.components.length > 50) {
    throw new BundlePolicyError("INVALID_BUNDLE", "Fixed bundle needs 2–50 components and a valid store/currency");
  }
  const fixedPriceMinor = whole(args.fixedPriceMinor, "fixed bundle price");
  const seen = new Set<string>();
  let regular = 0;
  const components = args.components.map(component => {
    if (!component.variantId || seen.has(component.variantId))
      throw new BundlePolicyError("INVALID_COMPONENT", "Duplicate or missing component variant");
    seen.add(component.variantId);
    if (component.organizationId !== args.organizationId || component.storeId !== args.storeId)
      throw new BundlePolicyError("TENANT_SCOPE_MISMATCH", "Cross-tenant bundle component refused");
    if (component.currency !== args.currency)
      throw new BundlePolicyError("INVALID_CURRENCY", "Mixed currencies in bundle refused");
    if (!component.active) throw new BundlePolicyError("COMPONENT_UNAVAILABLE", "Inactive component");
    whole(component.quantity, "quantity", 1);
    if (component.quantity > 20) throw new BundlePolicyError("INVALID_QUANTITY", "Bundle component exceeds 20 units");
    whole(component.unitPriceMinor, "unit price");
    if (component.fulfillment === "PHYSICAL") {
      if (!component.unlimitedInventory && (
        component.availablePhysicalQuantity === undefined ||
        whole(component.availablePhysicalQuantity, "available stock") < component.quantity)) {
        throw new BundlePolicyError("OUT_OF_STOCK", "Insufficient stock for bundle component");
      }
    } else if (component.fulfillment === "DIGITAL") {
      if (!component.privateDigitalFileReady)
        throw new BundlePolicyError("MISSING_PRIVATE_FILE", "Bundle download has no private delivery file");
    } else {
      throw new BundlePolicyError("NESTED_BUNDLE_REFUSED", "Nested/unknown bundle components are unsupported");
    }
    const baseMinor = whole(component.quantity * component.unitPriceMinor, "component base");
    regular = whole(regular + baseMinor, "bundle regular total");
    return {variantId: component.variantId, fulfillment: component.fulfillment,
      quantity: component.quantity, baseMinor};
  });
  if (fixedPriceMinor > regular)
    throw new BundlePolicyError("INVALID_BUNDLE_PRICE", "Bundle cannot cost more than its components");
  if (regular === 0 && fixedPriceMinor !== 0)
    throw new BundlePolicyError("INVALID_BUNDLE_PRICE", "Zero-value components cannot have nonzero price");
  const allocations = components.map(component => {
    const numerator = BigInt(component.baseMinor) * BigInt(fixedPriceMinor);
    const floor = regular === 0 ? 0 : Number(numerator / BigInt(regular));
    const remainder = regular === 0 ? 0n : numerator % BigInt(regular);
    return {component, floor, remainder, extra: 0};
  });
  let pennies = fixedPriceMinor - allocations.reduce((sum, item) => sum + item.floor, 0);
  for (const item of [...allocations].sort((a,b) =>
       a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 :
       a.component.variantId.localeCompare(b.component.variantId))) {
    if (pennies === 0) break;
    item.extra = 1;
    pennies -= 1;
  }
  if (pennies !== 0) throw new BundlePolicyError("ALLOCATION_ERROR", "Failed to allocate fixed bundle price");
  const result = allocations.map(({component,floor,extra}) => ({
    variantId: component.variantId, fulfillment: component.fulfillment,
    quantity: component.quantity, baseMinor: component.baseMinor,
    netMinor: floor + extra, discountMinor: component.baseMinor - floor - extra,
  }));
  if (result.some(line => line.netMinor > line.baseMinor || line.discountMinor < 0))
    throw new BundlePolicyError("ALLOCATION_ERROR", "Invalid bundle allocation");
  return {currency: args.currency, regularTotalMinor: regular,
    bundleTotalMinor: fixedPriceMinor, savingsMinor: regular - fixedPriceMinor, components: result};
}
