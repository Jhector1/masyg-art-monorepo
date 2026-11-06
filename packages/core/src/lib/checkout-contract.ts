import { z } from "zod";
import type { quoteLines } from "./cart-contract";

/** A buyer cannot submit a price, merchant account, tax rate, payment ID, or order status. */
export const shippingAddressInput = z.object({
  recipient: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(1).max(24),
  country: z.string().trim().regex(/^[A-Z]{2}$/),
}).strict();

export const checkoutPreflightInput = z.object({
  email: z.string().trim().email().max(254),
  shippingAddress: shippingAddressInput.optional(),
}).strict();
export type CheckoutPreflightInput = z.infer<typeof checkoutPreflightInput>;
export type CartQuote = ReturnType<typeof quoteLines>;

export const checkoutBlockerCodes = [
  "EMPTY_CART", "CART_HAS_ISSUES", "INVALID_CURRENCY", "INVALID_SUBTOTAL",
  "CONTACT_REQUIRED", "SHIPPING_ADDRESS_REQUIRED", "TAX_NOT_QUOTED",
  "SHIPPING_NOT_QUOTED", "PAYMENT_CONNECTION_NOT_VERIFIED", "INVENTORY_NOT_RESERVED",
] as const;
export type CheckoutBlocker = typeof checkoutBlockerCodes[number];

/**
 * This intentionally NEVER indicates that a customer may be charged. A quote
 * is neither a price guarantee nor a payment authorization. All order creation
 * must later reprice inside a transaction and obtain trusted tax/shipping rates.
 */
export function evaluateCheckoutPreflight(cart: CartQuote, contact?: CheckoutPreflightInput) {
  const blockers: CheckoutBlocker[] = [];
  const hasPhysical = cart.items.some(line => line.fulfillment === "PHYSICAL");
  const hasDigital = cart.items.some(line => line.fulfillment === "DIGITAL");
  if (cart.items.length === 0) blockers.push("EMPTY_CART");
  if (cart.issues.length > 0 || cart.items.some(line => !line.available)) blockers.push("CART_HAS_ISSUES");
  if (!cart.currency || !/^[A-Z]{3}$/.test(cart.currency)) blockers.push("INVALID_CURRENCY");
  if (!Number.isSafeInteger(cart.subtotalMinor) || cart.subtotalMinor < 0 ||
      cart.items.some(line => !Number.isSafeInteger(line.lineMinor) || line.lineMinor < 0 ||
        line.currency !== cart.currency) ||
      cart.items.reduce((total, line) => total + line.lineMinor, 0) !== cart.subtotalMinor) {
    blockers.push("INVALID_SUBTOTAL");
  }
  if (!contact) blockers.push("CONTACT_REQUIRED");
  if (hasPhysical && !contact?.shippingAddress) blockers.push("SHIPPING_ADDRESS_REQUIRED");
  // Tax obligations can apply to both physical and digital products.
  blockers.push("TAX_NOT_QUOTED");
  if (hasPhysical) blockers.push("SHIPPING_NOT_QUOTED", "INVENTORY_NOT_RESERVED");
  blockers.push("PAYMENT_CONNECTION_NOT_VERIFIED");
  // The endpoint intentionally omits all customer PII and provider account IDs.
  return {
    currency: cart.currency, subtotalMinor: cart.subtotalMinor,
    itemCount: cart.items.reduce((n, line) => n + line.quantity, 0),
    fulfillment: { physical: hasPhysical, digital: hasDigital },
    shippingAddressRequired: hasPhysical,
    blockers, checkoutEnabled: false as const,
    message: "Preflight only; no order, inventory reservation, or payment is created.",
  };
}
