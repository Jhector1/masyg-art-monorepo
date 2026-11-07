/** Pure monetary and ownership policy for a future provider-verified refund journal.
 * No mutation or customer-level entitlement decisions happen here.
 * The Stripe adapter must authenticate the signed event, retrieve authoritative
 * provider objects on the verified connected account and validate payment owner.
 */
import { CommerceInvariantError } from "./commerce-invariants";

export type RefundRecordStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export type RefundPaymentScope = {
  organizationId: string;
  paymentId: string;
  provider: "stripe";
  providerAccount: string;
  providerChargeId: string;
  currency: string;
  amountMinor: number;
};

export type RefundJournalEntry = {
  organizationId: string;
  paymentId: string;
  provider: "stripe";
  providerAccount: string;
  providerChargeId: string;
  providerRefundId: string;
  amountMinor: number;
  currency: string;
  status: RefundRecordStatus;
};

function validIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_-]{3,128}$/.test(value);
}

function validMoney(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
}

function validPayment(payment: RefundPaymentScope): boolean {
  return Boolean(payment &&
    validIdentifier(payment.organizationId) && validIdentifier(payment.paymentId) &&
    payment.provider === "stripe" &&
    /^acct_[A-Za-z0-9]{6,}$/.test(payment.providerAccount) &&
    /^ch_[A-Za-z0-9_]+$/.test(payment.providerChargeId) &&
    /^[A-Z]{3}$/.test(payment.currency) && validMoney(payment.amountMinor));
}

/** Validate a provider-verified refund against the immutable payment scope. */
export function assertRefundMatchesPayment(payment: RefundPaymentScope, refund: RefundJournalEntry): void {
  if (!validPayment(payment)) {
    throw new CommerceInvariantError("REFUND_PAYMENT_INVALID", "Invalid refund payment scope");
  }
  if (!refund ||
      refund.organizationId !== payment.organizationId ||
      refund.paymentId !== payment.paymentId ||
      refund.provider !== payment.provider ||
      refund.providerAccount !== payment.providerAccount ||
      refund.providerChargeId !== payment.providerChargeId ||
      refund.currency !== payment.currency ||
      !/^re_[A-Za-z0-9_]+$/.test(refund.providerRefundId) ||
      !validMoney(refund.amountMinor) ||
      refund.amountMinor > payment.amountMinor ||
      !(["PENDING", "SUCCEEDED", "FAILED", "CANCELED"] as string[]).includes(refund.status)) {
    throw new CommerceInvariantError("REFUND_JOURNAL_INVALID", "Refund does not match immutable payment scope");
  }
}

/** Compute totals using distinct provider refund IDs, never webhook event IDs.
 * Failed and canceled refunds do not reduce the outstanding paid amount.
 * Pending refunds remain visible, but are NOT booked as succeeded.
 */
export function summarizeVerifiedRefunds(payment: RefundPaymentScope, rows: readonly RefundJournalEntry[]) {
  if (!validPayment(payment)) {
    throw new CommerceInvariantError("REFUND_PAYMENT_INVALID", "Invalid refund payment scope");
  }
  const seen = new Set<string>();
  let succeededMinor = 0;
  let pendingMinor = 0;
  for (const row of rows) {
    assertRefundMatchesPayment(payment, row);
    if (seen.has(row.providerRefundId)) {
      throw new CommerceInvariantError("REFUND_DUPLICATE_ID", "Provider refund ID is duplicated");
    }
    seen.add(row.providerRefundId);
    if (row.status === "SUCCEEDED") succeededMinor += row.amountMinor;
    if (row.status === "PENDING") pendingMinor += row.amountMinor;
    if (!Number.isSafeInteger(succeededMinor + pendingMinor) ||
        succeededMinor + pendingMinor > payment.amountMinor) {
      throw new CommerceInvariantError("REFUND_AMOUNT_CONFLICT", "Provider refunds exceed recorded payment");
    }
  }
  return {
    succeededMinor,
    pendingMinor,
    remainingMinor: payment.amountMinor - succeededMinor,
    fullyRefunded: succeededMinor === payment.amountMinor,
    partiallyRefunded: succeededMinor > 0 && succeededMinor < payment.amountMinor,
  };
}
