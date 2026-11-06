import { getGuestCart } from "./cart-service";
import { checkoutPreflightInput, evaluateCheckoutPreflight } from "./checkout-contract";

/** Shared by all storefronts. Tenant context is resolved by the cart domain service. */
export async function getCheckoutPreflight(args: {
  storeId: string; rawToken?: string; contact?: unknown;
}) {
  // Validation precedes all database access and never persists customer PII.
  const contact = args.contact === undefined ? undefined : checkoutPreflightInput.parse(args.contact);
  const quote = await getGuestCart({storeId: args.storeId, rawToken: args.rawToken});
  return evaluateCheckoutPreflight(quote, contact);
}
