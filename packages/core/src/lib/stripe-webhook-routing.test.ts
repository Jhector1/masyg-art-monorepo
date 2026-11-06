import { validateFullRefundEvidence } from "./stripe-refund-ledger";

const evidence = {
  eventId: "evt_1234567",
  providerAccount: "acct_1234567",
  paymentIntentId: "pi_1234567",
  chargeId: "ch_1234567",
  amountMinor: 1000,
  currency: "USD",
  orderId: "order_001",
  storeId: "store_001",
  organizationId: "org_001",
};

test("full refund evidence rejects malformed amounts and provider/merchant/order identifiers", () => {
  expect(() => validateFullRefundEvidence(evidence)).not.toThrow();

  // The validator checks *syntax*. It cannot determine ownership from opaque IDs.
  for (const change of [
    { amountMinor: -1 },
    { organizationId: "bad!" },
    { organizationId: "" },
    { storeId: "?" },
    { orderId: "" },
    { providerAccount: "acct" },
    { chargeId: "fake" },
  ]) {
    expect(() => validateFullRefundEvidence({ ...evidence, ...change })).toThrow();
  }
});

test("well-formed foreign organization IDs must be checked against the stored payment", () => {
  // A different valid ID is NOT a syntax error; settleVerifiedFullRefund
  // must enforce merchant/store/order ownership transactionally.
  expect(() => validateFullRefundEvidence({ ...evidence, organizationId: "org_other" })).not.toThrow();
});
