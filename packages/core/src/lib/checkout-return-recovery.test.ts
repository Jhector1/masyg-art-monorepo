import {
  CHECKOUT_STATUS_MAX_AUTOMATIC_POLLS,
  CHECKOUT_STATUS_POLL_INTERVAL_MS,
  shouldAutoPollCheckoutStatus,
} from "./checkout-return-recovery";

test("checks a pending order on a bounded three-second schedule", () => {
  expect(CHECKOUT_STATUS_POLL_INTERVAL_MS).toBe(3000);
  expect(CHECKOUT_STATUS_MAX_AUTOMATIC_POLLS).toBe(20);
  expect(shouldAutoPollCheckoutStatus(true, 0)).toBe(true);
  expect(shouldAutoPollCheckoutStatus(true, 19)).toBe(true);
  expect(shouldAutoPollCheckoutStatus(true, 20)).toBe(false);
  expect(shouldAutoPollCheckoutStatus(true, 21)).toBe(false);
});

test("never polls already-settled or invalid counts", () => {
  expect(shouldAutoPollCheckoutStatus(false, 0)).toBe(false);
  expect(shouldAutoPollCheckoutStatus(false, 10)).toBe(false);
  for (const count of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(shouldAutoPollCheckoutStatus(true, count)).toBe(false);
  }
});
