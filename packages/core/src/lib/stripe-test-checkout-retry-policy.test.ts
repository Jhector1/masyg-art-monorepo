import { CHECKOUT_PREPARED_EXPIRED, mayRetryExpiredPreparedCheckout } from "./stripe-test-checkout-retry-policy";

describe("server-authorized checkout nonce rotation", () => {
  test("allows only an explicit 409 confirming safe expired-PREPARED cleanup", () => {
    expect(mayRetryExpiredPreparedCheckout(409, {code: CHECKOUT_PREPARED_EXPIRED})).toBe(true);
    for (const code of ["PROVIDER_RECONCILIATION_REQUIRED", "CHECKOUT_CLOSED", "STRIPE_PRECONDITION", "SESSION_CREATING", null]) {
      expect(mayRetryExpiredPreparedCheckout(409, {code})).toBe(false);
    }
    expect(mayRetryExpiredPreparedCheckout(503, {code:CHECKOUT_PREPARED_EXPIRED})).toBe(false);
    expect(mayRetryExpiredPreparedCheckout(200, {code:CHECKOUT_PREPARED_EXPIRED})).toBe(false);
    expect(mayRetryExpiredPreparedCheckout(409, "CHECKOUT_PREPARED_EXPIRED")).toBe(false);
    expect(mayRetryExpiredPreparedCheckout(409, null)).toBe(false);
    expect(mayRetryExpiredPreparedCheckout(409, [])).toBe(false);
  });
});
