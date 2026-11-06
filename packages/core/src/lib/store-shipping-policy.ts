import { z } from "zod";
import { CommerceInvariantError } from "./commerce-invariants";

/** Merchant-authored flat rates only. Money is always integer minor units. */
const taxCode = z.string().regex(/^txcd_[0-9]{8}$/);
const rateInput = z.object({
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  region: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{0,16}$/), // empty = countrywide
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  amountMinor: z.number().int().min(0).max(2_147_483_647),
  enabled: z.boolean(),
}).strict();
export const storeShippingInput = z.object({
  enabled: z.boolean(),
  physicalTaxCode: taxCode.nullable(),
  shippingTaxCode: taxCode.nullable(),
  rates: z.array(rateInput).max(40),
}).strict();
export type StoreShippingInput = z.infer<typeof storeShippingInput>;

/** Reject ambiguous rules before DB writes, with exact country/region/currency keys. */
export function validateStoreShippingSettings(raw: unknown): StoreShippingInput {
  const input = storeShippingInput.parse(raw);
  const seen = new Set<string>();
  for (const rate of input.rates) {
    const key = `${rate.country}/${rate.region}/${rate.currency}`;
    if (seen.has(key)) throw new CommerceInvariantError("SHIPPING_RULE_CONFLICT", "Only one flat rate per destination and currency is allowed");
    seen.add(key);
  }
  if (input.enabled) {
    if (!input.physicalTaxCode) throw new CommerceInvariantError("PHYSICAL_TAX_CLASSIFICATION_REQUIRED", "A physical product tax category is required before enabling test shipping");
    const enabledRates = input.rates.filter(r => r.enabled);
    if (!enabledRates.length) throw new CommerceInvariantError("SHIPPING_RULE_REQUIRED", "At least one enabled shipping rate is required");
    if (enabledRates.some(r => r.amountMinor > 0) && !input.shippingTaxCode) {
      throw new CommerceInvariantError("SHIPPING_TAX_CLASSIFICATION_REQUIRED", "A shipping tax category is required for paid shipping");
    }
  }
  return input;
}

/** Default-deny: merchant readiness and server opt-in are independent. */
export function mixedTestCheckoutAllowed(args:{serverFlag:string | undefined; merchantEnabled:boolean; rateCount:number}) {
  return args.serverFlag === "true" && args.merchantEnabled === true && Number.isSafeInteger(args.rateCount) && args.rateCount > 0;
}
