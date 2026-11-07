import { prisma } from "@acme/core/lib/prisma";
import { settleVerifiedStripeRefundSnapshot, type VerifiedStripeRefundSnapshot } from "./stripe-refund-journal";

jest.mock("@acme/core/lib/prisma", () => ({prisma: {$transaction: jest.fn()}}));
const db = prisma as unknown as {$transaction: jest.Mock};
const base: VerifiedStripeRefundSnapshot = {
  eventId: "evt_refund_1234567",
  providerAccount: "acct_1234567",
  paymentIntentId: "pi_1234567",
  chargeId: "ch_1234567",
  organizationId: "org_001",
  storeId: "store_001",
  orderId: "order_001",
  amountMinor: 1000,
  currency: "USD",
  refunds: [{providerRefundId: "re_1234567", amountMinor: 300, currency: "USD", status: "SUCCEEDED"}],
};
const payment = {
  id: "pay_001", organizationId: "org_001", orderId: "order_001", provider: "stripe",
  providerAccount: "acct_1234567", providerPaymentId: "pi_1234567",
  amountMinor: 1000, currency: "USD", status: "SUCCEEDED",
  order: {id: "order_001", organizationId: "org_001", storeId: "store_001",
    status: "PAID", totalMinor: 1000, currency: "USD"},
};
function createTx(opts: {existing?: Array<any>; payment?: any; event?: any} = {}) {
  const existing = opts.existing ?? [];
  return {
    payment: {
      findFirst: jest.fn().mockResolvedValue(opts.payment === undefined ? payment : opts.payment),
      updateMany: jest.fn().mockResolvedValue({count: 1}),
    },
    paymentRefund: {
      findMany: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({id: "journal_001"}),
      updateMany: jest.fn().mockResolvedValue({count: 1}),
    },
    providerEvent: {
      findUnique: jest.fn().mockResolvedValue(opts.event ?? null),
      create: jest.fn().mockResolvedValue({id: "event_001"}),
    },
    order: {updateMany: jest.fn().mockResolvedValue({count: 1})},
    digitalGrant: {updateMany: jest.fn().mockResolvedValue({count: 1})},
  };
}
function wire(tx: any) {
  db.$transaction.mockImplementation((fn: (t: any) => Promise<unknown>) => fn(tx));
}
beforeEach(() => jest.clearAllMocks());

test("verified successful partial refund is journaled without touching order or grants", async () => {
  const tx = createTx(); wire(tx);
  const result = await settleVerifiedStripeRefundSnapshot(base);
  expect(result).toMatchObject({status: "PARTIALLY_REFUNDED", succeededMinor: 300, replay: false});
  expect(tx.paymentRefund.create).toHaveBeenCalledTimes(1);
  expect(tx.providerEvent.create).toHaveBeenCalledTimes(1);
  expect(tx.payment.updateMany).not.toHaveBeenCalled();
  expect(tx.order.updateMany).not.toHaveBeenCalled();
  expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
});

test("pending refund is recorded but not considered money returned", async () => {
  const tx = createTx(); wire(tx);
  const result = await settleVerifiedStripeRefundSnapshot({
    ...base, refunds: [{...base.refunds[0], status: "PENDING"}],
  });
  expect(result).toMatchObject({status: "REFUND_PENDING", succeededMinor: 0, pendingMinor: 300});
  expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
});

test("multiple successful partial refunds sum to full and revoke in same transaction", async () => {
  const tx = createTx(); wire(tx);
  const result = await settleVerifiedStripeRefundSnapshot({
    ...base, refunds: [...base.refunds, {...base.refunds[0], providerRefundId: "re_2345678", amountMinor: 700}],
  });
  expect(result).toMatchObject({status: "REFUNDED", succeededMinor: 1000});
  expect(tx.paymentRefund.create).toHaveBeenCalledTimes(2);
  expect(tx.payment.updateMany).toHaveBeenCalledTimes(1);
  expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
  expect(tx.digitalGrant.updateMany).toHaveBeenCalledTimes(1);
});

test("existing full refund can be journaled without revoking twice", async () => {
  const tx = createTx({payment: {...payment, status: "REFUNDED", order: {...payment.order, status: "REFUNDED"}}});
  wire(tx);
  await expect(settleVerifiedStripeRefundSnapshot({
    ...base, refunds: [{...base.refunds[0], amountMinor: 1000}],
  })).resolves.toMatchObject({status: "REFUNDED", replay: true});
  expect(tx.payment.updateMany).not.toHaveBeenCalled();
  expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
});

test("repeated signed provider event doesn't create another event", async () => {
  const row = {...base.refunds[0], organizationId: payment.organizationId, paymentId: payment.id,
    provider: "stripe", providerAccount: base.providerAccount, providerChargeId: base.chargeId};
  const tx = createTx({existing: [row], event: {organizationId: base.organizationId, status: "PROCESSED"}});
  wire(tx);
  await expect(settleVerifiedStripeRefundSnapshot(base)).resolves.toMatchObject({replay: true});
  expect(tx.paymentRefund.create).not.toHaveBeenCalled();
  expect(tx.providerEvent.create).not.toHaveBeenCalled();
  expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
});

test("a pending refund may advance to succeeded, without double-counting its ID", async () => {
  const existing = [{...base.refunds[0], status: "PENDING", organizationId: payment.organizationId,
    paymentId: payment.id, provider: "stripe", providerAccount: base.providerAccount,
    providerChargeId: base.chargeId}];
  const tx = createTx({existing}); wire(tx);
  await expect(settleVerifiedStripeRefundSnapshot(base)).resolves.toMatchObject({succeededMinor: 300});
  expect(tx.paymentRefund.create).not.toHaveBeenCalled();
  expect(tx.paymentRefund.updateMany).toHaveBeenCalledTimes(1);
});

test("a succeeded refund cannot regress to pending", async () => {
  const existing = [{...base.refunds[0], organizationId: payment.organizationId,
    paymentId: payment.id, provider: "stripe", providerAccount: base.providerAccount,
    providerChargeId: base.chargeId}];
  const tx = createTx({existing}); wire(tx);
  await expect(settleVerifiedStripeRefundSnapshot({
    ...base, refunds: [{...base.refunds[0], status: "PENDING"}],
  })).rejects.toThrow();
  expect(tx.providerEvent.create).not.toHaveBeenCalled();
});

test("foreign tenant or mismatched stored payment is rejected", async () => {
  for (const bad of [
    {...payment, order: {...payment.order, storeId: "store_other"}},
    {...payment, status: "FAILED"},
    null,
  ]) {
    const tx = createTx({payment: bad}); wire(tx);
    await expect(settleVerifiedStripeRefundSnapshot(base)).rejects.toThrow();
    expect(tx.paymentRefund.create).not.toHaveBeenCalled();
    expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
  }
});

test("foreign provider event replays are rejected", async () => {
  const tx = createTx({event: {organizationId: "org_other", status: "PROCESSED"}}); wire(tx);
  await expect(settleVerifiedStripeRefundSnapshot(base)).rejects.toThrow();
  expect(tx.paymentRefund.create).not.toHaveBeenCalled();
});

test("duplicate refund IDs and cumulative over-refund fail before DB writes", async () => {
  for (const refunds of [
    [base.refunds[0], base.refunds[0]],
    [base.refunds[0], {...base.refunds[0], providerRefundId: "re_2345678", amountMinor: 701}],
  ]) {
    const tx = createTx(); wire(tx);
    await expect(settleVerifiedStripeRefundSnapshot({...base, refunds})).rejects.toThrow();
    expect(tx.paymentRefund.create).not.toHaveBeenCalled();
    expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
  }
});

test("missing provider refund or refund identity mutation refuses", async () => {
  const existing = [{...base.refunds[0], organizationId: payment.organizationId,
    paymentId: payment.id, provider: "stripe", providerAccount: base.providerAccount,
    providerChargeId: base.chargeId}];
  const tx = createTx({existing}); wire(tx);
  await expect(settleVerifiedStripeRefundSnapshot({
    ...base, refunds: [{...base.refunds[0], providerRefundId: "re_2345678"}],
  })).rejects.toThrow();
  expect(tx.paymentRefund.create).not.toHaveBeenCalled();
});

test("already-refunded order cannot be replayed with only partial totals", async () => {
  const tx = createTx({payment: {...payment, status: "REFUNDED", order: {...payment.order, status: "REFUNDED"}}});
  wire(tx);
  await expect(settleVerifiedStripeRefundSnapshot(base)).rejects.toThrow();
  expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
});
