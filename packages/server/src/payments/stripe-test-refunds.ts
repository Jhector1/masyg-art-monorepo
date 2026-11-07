import Stripe from "stripe";
import { prisma } from "@acme/core/lib/prisma";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import {
  settleVerifiedStripeRefundSnapshot,
  type VerifiedStripeRefundSnapshot,
} from "@acme/core/lib/stripe-refund-journal";

/** Only called with a signature-verified Stripe TEST Connect webhook event.
 * The signed payload is a *hint* for which Charge to fetch. The complete refund
 * history, payment owner, and amount are obtained from Stripe + our database.
 */
export async function reconcileSignedStripeTestRefund(event: Stripe.Event, platformTestKey: string) {
  const types = ["charge.refunded", "refund.created", "refund.updated", "refund.failed"];
  if (!types.includes(event.type) || event.livemode !== false ||
      !event.account || !/^acct_[A-Za-z0-9]{6,}$/.test(event.account)) {
    throw new CommerceInvariantError("REFUND_EVENT_INVALID", "Test Connect refund event required");
  }
  if (!/^sk_test_[A-Za-z0-9]{8,}$/.test(platformTestKey)) {
    throw new CommerceInvariantError("REFUND_TEST_KEY_INVALID", "Stripe TEST platform key required");
  }
  const isChargeEvent = event.type === "charge.refunded";
  const signed = event.data.object as Stripe.Charge | Stripe.Refund;
  const refundCharge = isChargeEvent ? null : (signed as Stripe.Refund).charge;
  const chargeId = isChargeEvent
    ? (signed as Stripe.Charge).id
    : typeof refundCharge === "string"
      ? refundCharge
      : refundCharge?.id;
  const triggerRefundId = isChargeEvent ? null : (signed as Stripe.Refund).id;
  if (!chargeId || !/^ch_[A-Za-z0-9_]+$/.test(chargeId) ||
      (!isChargeEvent && (!triggerRefundId || !/^re_[A-Za-z0-9_]+$/.test(triggerRefundId)))) {
    throw new CommerceInvariantError("REFUND_EVENT_INVALID", "Refund event lacks valid provider identity");
  }

  const stripe = new Stripe(platformTestKey);
  const options = { stripeAccount: event.account };
  const charge = await stripe.charges.retrieve(chargeId, options);
  if (charge.id !== chargeId || charge.livemode !== false ||
      charge.status !== "succeeded" || charge.paid !== true ||
      !Number.isSafeInteger(charge.amount) || charge.amount < 1 ||
      charge.amount > 2147483647 || !charge.currency ||
      typeof charge.payment_intent !== "string") {
    throw new CommerceInvariantError("REFUND_EVIDENCE_INVALID", "Charge is not a settled test payment");
  }
  const intent = await stripe.paymentIntents.retrieve(charge.payment_intent, options);
  const latest = typeof intent.latest_charge === "string"
    ? intent.latest_charge : intent.latest_charge?.id;
  const meta = intent.metadata;
  if (intent.livemode !== false || intent.id !== charge.payment_intent ||
      latest !== charge.id || intent.currency !== charge.currency ||
      intent.amount_received !== charge.amount ||
      !meta?.organizationId || !meta?.storeId || !meta?.orderId || !meta?.connectionId) {
    throw new CommerceInvariantError("REFUND_EVIDENCE_INVALID", "Refund does not match settled PaymentIntent");
  }
  const connection = await prisma.integrationConnection.findFirst({where: {
    id: meta.connectionId, organizationId: meta.organizationId,
    provider: "stripe", accountRef: event.account,
    status: "VERIFIED", capabilities: {has: "payments"},
  }, select: {id: true, verifiedAt: true}});
  if (!connection?.verifiedAt) {
    throw new CommerceInvariantError("REFUND_OWNER_MISMATCH", "Connected merchant is not verified");
  }
  const original = await prisma.payment.findFirst({where: {
    organizationId: meta.organizationId, orderId: meta.orderId,
    provider: "stripe", providerAccount: event.account,
    providerPaymentId: intent.id,
  }, select: {order: {select: {storeId: true}}, currency: true, amountMinor: true}});
  if (!original || original.order.storeId !== meta.storeId ||
      original.amountMinor !== charge.amount ||
      original.currency !== charge.currency.toUpperCase()) {
    throw new CommerceInvariantError("REFUND_OWNER_MISMATCH", "Refund is not associated with stored payment");
  }

  // List *all* refunds rather than trusting Charge.refunds (which may have only 10).
  // Never commit a truncated snapshot; 2000 rows is the journal's safety ceiling.
  const rows: VerifiedStripeRefundSnapshot["refunds"][number][] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await stripe.refunds.list({charge: charge.id, limit: 100,
      ...(cursor ? {starting_after: cursor} : {})}, options);
    if (!page.data.length || rows.length + page.data.length > 2000) {
      throw new CommerceInvariantError("REFUND_SNAPSHOT_INCOMPLETE", "Incomplete provider refund list");
    }
    for (const refund of page.data) {
      const refundChargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
      const refundIntentId = typeof refund.payment_intent === "string"
        ? refund.payment_intent : refund.payment_intent?.id;
      if (refundChargeId !== charge.id || refundIntentId !== intent.id ||
          !/^re_[A-Za-z0-9_]+$/.test(refund.id) ||
          !Number.isSafeInteger(refund.amount) || refund.amount < 1 ||
          refund.currency !== charge.currency) {
        throw new CommerceInvariantError("REFUND_EVIDENCE_INVALID", "Stripe refund identity mismatch");
      }
      const status = refund.status === "succeeded" ? "SUCCEEDED" as const :
        (refund.status === "pending" || refund.status === "requires_action") ? "PENDING" as const :
          refund.status === "failed" ? "FAILED" as const :
            refund.status === "canceled" ? "CANCELED" as const : null;
      if (!status) {
        throw new CommerceInvariantError("REFUND_STATUS_UNKNOWN", "Unknown Stripe refund status");
      }
      rows.push({providerRefundId: refund.id, amountMinor: refund.amount,
        currency: refund.currency.toUpperCase(), status});
    }
    if (!page.has_more) break;
    if (rows.length === 2000) {
      throw new CommerceInvariantError("REFUND_SNAPSHOT_INCOMPLETE", "Refund history exceeds journal limit");
    }
    const nextCursor = page.data[page.data.length - 1].id;
    if (!nextCursor || nextCursor === cursor) {
      throw new CommerceInvariantError("REFUND_SNAPSHOT_INCOMPLETE", "Provider pagination did not advance");
    }
    cursor = nextCursor;
  }
  if (triggerRefundId && !rows.some(row => row.providerRefundId === triggerRefundId)) {
    throw new CommerceInvariantError("REFUND_SNAPSHOT_INCOMPLETE", "Signed refund missing from provider history");
  }
  return settleVerifiedStripeRefundSnapshot({
    eventId: event.id, providerAccount: event.account,
    paymentIntentId: intent.id, chargeId: charge.id,
    organizationId: meta.organizationId, storeId: meta.storeId,
    orderId: meta.orderId, amountMinor: charge.amount,
    currency: charge.currency.toUpperCase(), refunds: rows,
  });
}
