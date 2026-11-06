import { CommerceInvariantError } from "./commerce-invariants";
import type { StripePaidWebhookEnvelope, StripePaymentSession } from "./stripe-paid-evidence";

/** Evidence for a terminal, unpaid Stripe Checkout Session, retrieved from Stripe
 * using the correct connected account. Signed webhook JSON is not evidence.
 * We intentionally DO NOT release on async_payment_failed here: a completed
 * Checkout Session can represent payment processing that needs separate reconciliation.
 */
export type VerifiedExpiredEvidence = {
  provider: "stripe";
  eventId: string;
  providerAccount: string;
  sessionId: string;
  attemptId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
};

function reject(): never {
  throw new CommerceInvariantError("STRIPE_CLOSURE_INVALID", "Stripe session is not safely expired and unpaid");
}

export function validateRetrievedStripeExpiredEvidence(
  envelope: StripePaidWebhookEnvelope,
  session: StripePaymentSession,
): VerifiedExpiredEvidence {
  if (!envelope || envelope.status !== "VERIFIED" ||
      envelope.eventType !== "checkout.session.expired" ||
      !/^evt_[A-Za-z0-9_]{6,}$/.test(envelope.eventId) ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(envelope.providerAccount) ||
      !/^cs_test_[A-Za-z0-9_]+$/.test(envelope.sessionId) ||
      !envelope.attemptId || !envelope.orderId ||
      !session || typeof session !== "object" ||
      session.id !== envelope.sessionId || session.livemode !== false ||
      session.mode !== "payment" || session.status !== "expired" ||
      session.payment_status !== "unpaid" ||
      session.client_reference_id !== envelope.attemptId ||
      session.metadata?.attemptId !== envelope.attemptId ||
      session.metadata?.orderId !== envelope.orderId ||
      !session.metadata?.organizationId || !session.metadata?.storeId ||
      !session.metadata?.connectionId ||
      !Number.isSafeInteger(session.amount_total) ||
      (session.amount_total ?? 0) <= 0 || (session.amount_total ?? 0) > 2147483647 ||
      !/^[a-z]{3}$/.test(session.currency ?? "")) reject();

  // No PaymentIntent is expected for most expired, uncompleted Checkout Sessions.
  // An expanded canceled intent with zero received is also terminal. Anything
  // processing, succeeded, unexpanded, or ambiguous remains reserved.
  const intent = session.payment_intent;
  if (intent !== null) {
    if (typeof intent !== "object" ||
        !/^pi_[A-Za-z0-9_]+$/.test(intent.id) || intent.livemode !== false ||
        intent.status !== "canceled" || intent.amount_received !== 0 ||
        intent.currency !== session.currency ||
        intent.metadata?.attemptId !== envelope.attemptId ||
        intent.metadata?.orderId !== envelope.orderId ||
        intent.metadata?.organizationId !== session.metadata.organizationId ||
        intent.metadata?.storeId !== session.metadata.storeId ||
        intent.metadata?.connectionId !== session.metadata.connectionId) reject();
  }
  return {provider:"stripe",eventId:envelope.eventId,
    providerAccount:envelope.providerAccount,sessionId:session.id,
    attemptId:envelope.attemptId,orderId:envelope.orderId,
    amountMinor:session.amount_total!,currency:session.currency!.toUpperCase()};
}
