import { checkoutPreflightInput, shippingAddressInput } from "./checkout-contract";
import { CommerceInvariantError } from "./commerce-invariants";
import { isStripeTaxCalculationId } from "./stripe-tax-calculation-id";
import { z } from "zod";

/** Checkout request never accepts amount, account, userId, tax, shipping price or order status. */
export const stripeTestCheckoutInput = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{24,128}$/),
  billingAddress: shippingAddressInput,
}).strict();
export type StripeTestCheckoutInput = z.infer<typeof stripeTestCheckoutInput>;

export function digitalTaxCode(capabilities: readonly string[]) {
  const codes = capabilities.filter(c => c.startsWith("tax-code:"));
  const code=codes[0];
  if (codes.length !== 1 || !code || !/^tax-code:txcd_[0-9]{8}$/.test(code))
    throw new CommerceInvariantError("TAX_CODE_REQUIRED", "Merchant needs exactly one verified digital tax classification");
  return code.slice("tax-code:".length);
}

export function trustedDigitalQuote(args:{
  organizationId:string;storeId:string;currency:string;cartFingerprint:string;
  taxId:string;taxMinor:number;amountTotal:number;subtotalMinor:number;
  shippingMinor:number;calculationExpiresAt?:number|null;now?:Date;
}) {
  const now=args.now??new Date();
  if (!isStripeTaxCalculationId(args.taxId) ||
      !/^[A-Z]{3}$/.test(args.currency) ||
      !Number.isSafeInteger(args.taxMinor) || args.taxMinor<0 ||
      !Number.isSafeInteger(args.subtotalMinor) || args.subtotalMinor<1 ||
      !Number.isSafeInteger(args.amountTotal) || args.amountTotal>2147483647 ||
      args.amountTotal!==args.subtotalMinor+args.taxMinor || args.shippingMinor!==0 ||
      !/^[0-9a-f]{64}$/.test(args.cartFingerprint))
    throw new CommerceInvariantError("TAX_QUOTE_INVALID","Cannot trust Stripe Tax calculation");
  const providerExpiry= typeof args.calculationExpiresAt==="number" && Number.isSafeInteger(args.calculationExpiresAt)
    ? args.calculationExpiresAt*1000 : now.getTime()+5*60*1000;
  const validUntil=new Date(Math.min(providerExpiry,now.getTime()+5*60*1000));
  if (validUntil.getTime()<=now.getTime()+10_000)
    throw new CommerceInvariantError("TAX_QUOTE_EXPIRED","Fresh tax quote required");
  return {organizationId:args.organizationId,storeId:args.storeId,
    reference:args.taxId,currency:args.currency,cartFingerprint:args.cartFingerprint,
    taxMinor:args.taxMinor,shippingMinor:0,validUntil};
}

export function contactForCheckout(email:string,billingAddress:unknown) {
  return checkoutPreflightInput.parse({email,shippingAddress:billingAddress});
}
