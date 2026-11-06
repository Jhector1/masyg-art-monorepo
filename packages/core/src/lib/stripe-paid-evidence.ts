import { CommerceInvariantError } from "./commerce-invariants";

/** Pure contract for a Stripe Session & expanded PaymentIntent retrieved by our
 * server with a TEST platform key and explicit stripeAccount request option.
 * Signed webhook payloads alone are NOT payment evidence.
 */
export type StripePaidWebhookEnvelope = {
  status: "VERIFIED";
  eventId: string;
  eventType: string;
  providerAccount: string;
  sessionId: string;
  attemptId: string;
  orderId: string;
};
export type StripePaymentSession = {
  id: string; livemode: boolean; mode: string | null; status: string | null;
  payment_status: string; amount_total: number | null; currency: string | null;
  client_reference_id: string | null; metadata: Record<string,string> | null;
  payment_intent: string | null | {
    id: string; status: string; livemode: boolean; currency: string;
    amount_received: number; metadata: Record<string,string> | null;
  };
};

export type VerifiedPaidEvidence = {
  provider: "stripe";
  providerEventId: string;
  providerAccount: string;
  providerPaymentId: string;
  sessionId: string;
  attemptId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
};

function fail(): never {
  throw new CommerceInvariantError("STRIPE_PAYMENT_INVALID", "Stripe payment evidence is not valid for this checkout");
}

/** Returns null for payment-pending sessions; caller must await a success event.
 * Do not consume a payment merely because Checkout emitted session.completed.
 */
export function validateRetrievedStripePaidEvidence(
  envelope: StripePaidWebhookEnvelope,
  session: StripePaymentSession,
): VerifiedPaidEvidence | null {
  if (!envelope || envelope.status !== "VERIFIED" ||
      !["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(envelope.eventType) ||
      !/^evt_[A-Za-z0-9_]{6,}$/.test(envelope.eventId) ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(envelope.providerAccount) ||
      !/^cs_test_[A-Za-z0-9_]+$/.test(envelope.sessionId) ||
      !envelope.attemptId || !envelope.orderId ||
      !session || typeof session !== "object" ||
      session.id !== envelope.sessionId || session.livemode !== false ||
      session.mode !== "payment" || session.client_reference_id !== envelope.attemptId ||
      session.metadata?.attemptId !== envelope.attemptId ||
      session.metadata?.orderId !== envelope.orderId ||
      !session.metadata?.organizationId || !session.metadata?.storeId || !session.metadata?.connectionId ||
      !Number.isSafeInteger(session.amount_total) || (session.amount_total ?? 0) < 1 ||
      !/^[a-z]{3}$/.test(session.currency ?? "")) fail();
  const intent = session.payment_intent;
  if (session.payment_status !== "paid") {
    // Completion of a delayed-payment Session is not a successful payment.
    // Never classify contradictory evidence (unpaid Session + succeeded Intent)
    // as an ordinary pending payment; reject it for explicit reconciliation.
    if (envelope.eventType === "checkout.session.completed" &&
        session.status === "complete" && session.payment_status === "unpaid") {
      if (intent !== null && (
          typeof intent !== "object" ||
          !/^pi_[A-Za-z0-9_]+$/.test(intent.id) || intent.livemode !== false ||
          intent.status === "succeeded" ||
          !Number.isSafeInteger(intent.amount_received) ||
          intent.amount_received < 0 || intent.amount_received > session.amount_total! ||
          intent.currency !== session.currency ||
          intent.metadata?.attemptId !== envelope.attemptId ||
          intent.metadata?.orderId !== envelope.orderId ||
          intent.metadata?.organizationId !== session.metadata.organizationId ||
          intent.metadata?.storeId !== session.metadata.storeId ||
          intent.metadata?.connectionId !== session.metadata.connectionId
      )) fail();
      return null;
    }
    return fail();
  }
  if (session.status !== "complete") fail();
  if (!intent || typeof intent === "string" || typeof intent !== "object" ||
      !/^pi_[A-Za-z0-9_]+$/.test(intent.id) || intent.livemode !== false ||
      intent.status !== "succeeded" || intent.amount_received !== session.amount_total ||
      intent.currency !== session.currency ||
      intent.metadata?.attemptId !== envelope.attemptId ||
      intent.metadata?.orderId !== envelope.orderId ||
      intent.metadata?.organizationId !== session.metadata.organizationId ||
      intent.metadata?.storeId !== session.metadata.storeId ||
      intent.metadata?.connectionId !== session.metadata.connectionId) fail();
  return {
    provider:"stripe",providerEventId:envelope.eventId,
    providerAccount:envelope.providerAccount,providerPaymentId:intent.id,
    sessionId:session.id,attemptId:envelope.attemptId,orderId:envelope.orderId,
    amountMinor:session.amount_total!,currency:session.currency!.toUpperCase(),
  };
}
