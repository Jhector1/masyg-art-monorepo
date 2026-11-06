import { isStripeTaxCalculationId } from "./stripe-tax-calculation-id";
import { verifyMixedStripeTaxQuote } from "./mixed-checkout-quote-policy";
import { trustedDigitalQuote } from "./stripe-test-checkout-input";

test("recognizes Stripe's real Tax Calculation IDs, not the old typo", () => {
  expect(isStripeTaxCalculationId("taxcalc_1OduxkBUZ691iUZ4iWvpMApI")).toBe(true);
  for (const bad of [null, undefined, "", "taxcal_1Oduxk", "tax_123", "taxcalc_", "taxcalc_hello/world", " taxcalc_123", "taxcalc_123\n", 123]) {
    expect(isStripeTaxCalculationId(bad)).toBe(false);
  }
});

test("digital quote accepts real Stripe calculation ID while preserving amount integrity", () => {
  const now = new Date("2026-11-05T18:00:00Z");
  const args = {
    organizationId: "org_test", storeId: "store_test", currency: "USD",
    cartFingerprint: "a".repeat(64), taxId: "taxcalc_1OduxkBUZ691iUZ4iWvpMApI",
    taxMinor: 0, subtotalMinor: 1000, amountTotal: 1000, shippingMinor: 0, now,
  };
  expect(trustedDigitalQuote(args).reference).toBe(args.taxId);
  expect(() => trustedDigitalQuote({...args, taxId: "taxcal_123"})).toThrow();
  expect(() => trustedDigitalQuote({...args, amountTotal: 999})).toThrow();
});

test("mixed quote accepts real Stripe calculation ID and reconciles shipping/tax", () => {
  const now = new Date("2026-11-05T18:00:00Z");
  const provider = {
    id: "taxcalc_1OduxkBUZ691iUZ4iWvpMApI",
    livemode: false, currency: "usd", amount_total: 8000,
    tax_amount_exclusive: 0, tax_amount_inclusive: 0,
    shipping_cost: {amount: 500},
  };
  const args = {
    organizationId: "org_test", storeId: "store_test", currency: "USD",
    fingerprint: "b".repeat(64), subtotalMinor: 7500, shippingMinor: 500,
    stripeCalculation: provider, now,
  };
  const trusted = verifyMixedStripeTaxQuote(args);
  expect(trusted.reference).toBe(provider.id);
  expect(trusted.shippingMinor).toBe(500);
  expect(trusted.taxMinor).toBe(0);
  expect(() => verifyMixedStripeTaxQuote({...args, stripeCalculation: {...provider, id: "taxcal_bad"}})).toThrow();
  expect(() => verifyMixedStripeTaxQuote({...args, stripeCalculation: {...provider, livemode: true}})).toThrow();
  expect(() => verifyMixedStripeTaxQuote({...args, stripeCalculation: {...provider, amount_total: 7999}})).toThrow();
  expect(() => verifyMixedStripeTaxQuote({...args, stripeCalculation: {...provider, shipping_cost: {amount: 400}}})).toThrow();
});
