import {assertRefundMatchesPayment, summarizeVerifiedRefunds} from "./partial-refund-policy";
import type {RefundPaymentScope, RefundJournalEntry} from "./partial-refund-policy";

const payment: RefundPaymentScope = {
  organizationId:"org_001", paymentId:"pay_001", provider:"stripe",
  providerAccount:"acct_1234567", providerChargeId:"ch_1234567",
  currency:"USD", amountMinor:1000,
};
const refund: RefundJournalEntry = {
  organizationId:payment.organizationId, paymentId:payment.paymentId,
  provider:payment.provider, providerAccount:payment.providerAccount,
  providerChargeId:payment.providerChargeId, providerRefundId:"re_1234567",
  amountMinor:300, currency:payment.currency, status:"SUCCEEDED",
};

test("valid partial refund is not a full refund",()=>{
  assertRefundMatchesPayment(payment,refund);
  expect(summarizeVerifiedRefunds(payment,[refund])).toEqual({
    succeededMinor:300,pendingMinor:0,remainingMinor:700,
    fullyRefunded:false,partiallyRefunded:true,
  });
});
test("multiple verified refunds sum to full amount",()=>{
  expect(summarizeVerifiedRefunds(payment,[refund,{...refund,providerRefundId:"re_2345678",amountMinor:700}]))
    .toMatchObject({succeededMinor:1000,remainingMinor:0,fullyRefunded:true,partiallyRefunded:false});
});
test("pending is visible but not treated as succeeded",()=>{
  expect(summarizeVerifiedRefunds(payment,[{...refund,status:"PENDING"}]))
    .toMatchObject({succeededMinor:0,pendingMinor:300,remainingMinor:1000,fullyRefunded:false});
});
test("failed and canceled do not reduce payment",()=>{
  expect(summarizeVerifiedRefunds(payment,[
    {...refund,status:"FAILED"},
    {...refund,providerRefundId:"re_2345678",status:"CANCELED"},
  ])).toMatchObject({succeededMinor:0,pendingMinor:0,remainingMinor:1000});
});
test("same provider refund ID cannot be counted twice",()=>{
  expect(()=>summarizeVerifiedRefunds(payment,[refund,refund])).toThrow();
});
test("successful refunds cannot exceed the original payment",()=>{
  expect(()=>summarizeVerifiedRefunds(payment,[refund,{...refund,providerRefundId:"re_2345678",amountMinor:701}])).toThrow();
});
test("pending and successful obligations cannot exceed original amount",()=>{
  expect(()=>summarizeVerifiedRefunds(payment,[refund,{...refund,providerRefundId:"re_2345678",amountMinor:701,status:"PENDING"}])).toThrow();
});
test.each([
  ["foreign organization",{organizationId:"org_other"}],
  ["foreign payment",{paymentId:"pay_other"}],
  ["foreign Connect account",{providerAccount:"acct_7654321"}],
  ["foreign charge",{providerChargeId:"ch_7654321"}],
  ["currency mismatch",{currency:"EUR"}],
  ["invalid refund ID",{providerRefundId:"evt_1234567"}],
  ["zero amount",{amountMinor:0}],
  ["fractional amount",{amountMinor:12.5}],
  ["unknown status",{status:"UNKNOWN" as RefundJournalEntry["status"]}],
])("%s rejected",(_label,override)=>{
  expect(()=>assertRefundMatchesPayment(payment,{...refund,...override})).toThrow();
});
test("invalid original payment is rejected even with an empty journal",()=>{
  expect(()=>summarizeVerifiedRefunds({...payment,amountMinor:0},[])).toThrow();
});
