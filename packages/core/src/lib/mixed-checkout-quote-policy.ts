import { CommerceInvariantError } from "./commerce-invariants";
import { isStripeTaxCalculationId } from "./stripe-tax-calculation-id";

/** v39D.5A: pure, server-side quote policy. This file does NOT enable payment,
 * create an order or reserve stock. Rates and tax categories MUST come from a
 * trusted merchant-scoped server configuration, never buyer-submitted JSON.
 * Supports explicitly configured flat shipping, not carrier-guaranteed quotes.
 */
const MAX_AMOUNT = 2_147_483_647;
const countryPattern = /^[A-Z]{2}$/;
const currencyPattern = /^[A-Z]{3}$/;
const taxCodePattern = /^txcd_[0-9]{8}$/;

export type MixedCheckoutLine = {
  variantId: string;
  fulfillment: "PHYSICAL" | "DIGITAL";
  quantity: number;
  unitPriceMinor: number;
  currency: string;
};

export type MerchantShippingRule = {
  organizationId: string;
  storeId: string;
  methodId: string;
  country: string;
  region: string | null; // null = all regions in country
  currency: string;
  amountMinor: number;
  enabled: boolean;
};

export type VariantTaxClassification = {
  variantId: string;
  taxCode: string;
};

export type MixedCheckoutQuotePolicyInput = {
  organizationId: string;
  storeId: string;
  currency: string;
  lines: readonly MixedCheckoutLine[];
  destination?: {country: string; region?: string | null};
  merchantRules: readonly MerchantShippingRule[];
  variantTaxCodes: readonly VariantTaxClassification[];
  shippingTaxCode?: string;
};

function reject(code: string, message: string): never {
  throw new CommerceInvariantError(code, message);
}

function amount(value: number, allowZero = true): number {
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT || value < (allowZero ? 0 : 1)) {
    reject("SHIPPING_AMOUNT_INVALID", "Amount is outside supported currency minor-unit bounds");
  }
  return value;
}

function required(value: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    reject("QUOTE_SCOPE_INVALID", "Merchant and variant identifiers are required");
  }
  return value;
}

/** Returns the exact server-selected shipping amount and Stripe Tax input lines.
 * No shipping address, shipping amount, tax classification or fulfillment kind
 * may be accepted from a buyer as a source of authority.
 */
export function planMixedCheckoutQuote(input: MixedCheckoutQuotePolicyInput) {
  const organizationId = required(input.organizationId);
  const storeId = required(input.storeId);
  if (!currencyPattern.test(input.currency) || !input.lines.length || input.lines.length > 100) {
    reject("CHECKOUT_QUOTE_INVALID", "Checkout currency or cart size is invalid");
  }
  const seen = new Set<string>();
  const classification = new Map<string, string>();
  for (const item of input.variantTaxCodes) {
    const id = required(item.variantId);
    if (classification.has(id) || !taxCodePattern.test(item.taxCode)) {
      reject("TAX_CLASSIFICATION_INVALID", "Each edition requires exactly one verified tax classification");
    }
    classification.set(id, item.taxCode);
  }

  let subtotalMinor = 0;
  let includesPhysical = false;
  let includesDigital = false;
  const taxLines = input.lines.map(line => {
    const id = required(line.variantId);
    if (seen.has(id) || !currencyPattern.test(line.currency) || line.currency !== input.currency ||
        (line.fulfillment !== "PHYSICAL" && line.fulfillment !== "DIGITAL") ||
        !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      reject("CHECKOUT_QUOTE_INVALID", "Cart contains invalid or repeated editions");
    }
    seen.add(id);
    const extended = line.quantity * amount(line.unitPriceMinor, false);
    if (!Number.isSafeInteger(extended) || extended > MAX_AMOUNT || subtotalMinor + extended > MAX_AMOUNT) {
      reject("CHECKOUT_QUOTE_INVALID", "Checkout subtotal is outside supported bounds");
    }
    subtotalMinor += extended;
    if (line.fulfillment === "PHYSICAL") includesPhysical = true;
    if (line.fulfillment === "DIGITAL") includesDigital = true;
    const code = classification.get(id);
    if (!code) reject("TAX_CLASSIFICATION_REQUIRED", "A published edition has no approved tax category");
    return {reference: id, amount: extended, tax_behavior: "exclusive" as const, tax_code: code};
  });
  if (classification.size !== seen.size) {
    reject("TAX_CLASSIFICATION_INVALID", "Unexpected or stale tax category mapping");
  }

  if (!includesPhysical) {
    return {subtotalMinor, shippingMinor: 0, shippingMethodId: null as string | null,
      hasPhysical: false as boolean, hasDigital: includesDigital,
      taxLines, shippingCost: null as {amount:number;tax_behavior:"exclusive";tax_code:string} | null};
  }
  const country = input.destination?.country;
  const region = input.destination?.region?.trim().toUpperCase() || null;
  if (!country || !countryPattern.test(country) || (region && !/^[A-Z0-9-]{1,16}$/.test(region))) {
    reject("SHIPPING_ADDRESS_REQUIRED", "Valid delivery country and region are required");
  }
  // Scope checks are applied to every eligible rule before selection. Nothing
  // belonging to another organization or storefront can be used as a fallback.
  const eligible = input.merchantRules.filter(r =>
    r.organizationId === organizationId && r.storeId === storeId &&
    r.country === country && r.currency === input.currency && r.enabled === true);
  for (const rule of eligible) {
    required(rule.methodId);
    if ((rule.region !== null && !/^[A-Z0-9-]{1,16}$/.test(rule.region)) ||
        !Number.isSafeInteger(rule.amountMinor) || rule.amountMinor < 0 || rule.amountMinor > MAX_AMOUNT) {
      reject("SHIPPING_CONFIGURATION_INVALID", "Merchant shipping rule is invalid");
    }
  }
  const local = eligible.filter(r => r.region !== null && r.region === region);
  const countrywide = eligible.filter(r => r.region === null);
  const selected = local.length ? local : countrywide;
  if (selected.length !== 1) {
    reject("SHIPPING_NOT_QUOTED", "No unambiguous merchant shipping rate covers the destination");
  }
  const rule = selected[0];
  if (!rule) reject("SHIPPING_NOT_QUOTED", "Shipping rate unavailable");
  const shippingMinor = amount(rule.amountMinor);
  if (subtotalMinor + shippingMinor > MAX_AMOUNT) {
    reject("CHECKOUT_QUOTE_INVALID", "Checkout total exceeds allowed bounds");
  }
  if (shippingMinor > 0 && !taxCodePattern.test(input.shippingTaxCode ?? "")) {
    reject("SHIPPING_TAX_CODE_REQUIRED", "Shipping requires an explicit merchant tax classification");
  }
  return {subtotalMinor, shippingMinor, shippingMethodId: rule.methodId,
    hasPhysical: includesPhysical, hasDigital: includesDigital, taxLines,
    shippingCost: shippingMinor > 0
      ? {amount: shippingMinor, tax_behavior: "exclusive" as const, tax_code: input.shippingTaxCode!}
      : null};
}

/** Validate Stripe Tax's response against the server-authored quote before it
 * can be passed into prepareCheckoutAttempt. Does not accept buyer totals.
 */
export function verifyMixedStripeTaxQuote(args: {
  organizationId: string; storeId: string; currency: string; fingerprint: string;
  subtotalMinor: number; shippingMinor: number;
  stripeCalculation: {
    id: string | null; livemode: boolean; currency: string;
    amount_total: number; tax_amount_exclusive: number; tax_amount_inclusive: number;
    expires_at?: number | null; shipping_cost?: {amount: number} | null;
  };
  now?: Date;
}) {
  required(args.organizationId); required(args.storeId);
  const now = args.now ?? new Date();
  const provider = args.stripeCalculation;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) ||
      !currencyPattern.test(args.currency) || !/^[a-f0-9]{64}$/.test(args.fingerprint) ||
      !provider || provider.livemode !== false || provider.currency !== args.currency.toLowerCase() ||
      !isStripeTaxCalculationId(provider.id) ||
      provider.tax_amount_inclusive !== 0) {
    reject("TAX_QUOTE_INVALID", "Stripe Tax calculation is not trustworthy");
  }
  const subtotalMinor = amount(args.subtotalMinor, false);
  const shippingMinor = amount(args.shippingMinor);
  const taxMinor = amount(provider.tax_amount_exclusive);
  if (provider.shipping_cost?.amount !== undefined &&
      provider.shipping_cost.amount !== shippingMinor) {
    reject("TAX_QUOTE_INVALID", "Stripe Tax shipping cost differs from merchant rate");
  }
  if (shippingMinor > 0 && provider.shipping_cost?.amount !== shippingMinor) {
    reject("TAX_QUOTE_INVALID", "Stripe Tax omitted the shipping charge");
  }
  if (subtotalMinor + shippingMinor + taxMinor !== provider.amount_total ||
      !Number.isSafeInteger(provider.amount_total) || provider.amount_total > MAX_AMOUNT) {
    reject("TAX_QUOTE_INVALID", "Provider total does not reconcile to cart, shipping, and tax");
  }
  const providerExpiryMs = Number.isSafeInteger(provider.expires_at)
    ? (provider.expires_at as number) * 1000 : now.getTime() + 5 * 60_000;
  const expiresAt = new Date(Math.min(providerExpiryMs, now.getTime() + 5 * 60_000));
  if (expiresAt.getTime() <= now.getTime() + 10_000) {
    reject("TAX_QUOTE_EXPIRED", "Stripe Tax calculation has expired");
  }
  return {organizationId: args.organizationId, storeId: args.storeId,
    reference: provider.id!, currency: args.currency, cartFingerprint: args.fingerprint,
    taxMinor, shippingMinor, validUntil: expiresAt};
}
