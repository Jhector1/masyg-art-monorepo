import type { CartQuote } from "./storefront-commerce";

/** The server supplies all quote prices in integer currency minor units. */
export function formatMinorMoney(minor: number, currency: string, locale = "en-US"): string {
  if (!Number.isSafeInteger(minor) || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Invalid server cart quote");
  }
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minor / (10 ** fractionDigits));
}

/** A quote is not a payment authorization. Never infer checkout readiness from quantity/price. */
export function isCartCheckoutAvailable(quote: CartQuote | null): boolean {
  return quote?.readyForCheckout ?? false;
}
