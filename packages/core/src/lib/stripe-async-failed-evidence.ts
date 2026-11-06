import { CommerceInvariantError } from "./commerce-invariants";
import type { StripePaidWebhookEnvelope, StripePaymentSession } from "./stripe-paid-evidence";

/** A failed async Checkout event does NOT imply that its PaymentIntent is terminal.
 * Return null until the provider confirms it has no possibility of collecting funds.
 * A canceled, zero-received expanded PaymentIntent is our narrow v15 closure proof.
 */
export type VerifiedAsyncFailedEvidence = {
  provider: "stripe";
  eventId: string;
  providerAccount: string;
  sessionId: string;
  attemptId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
};
function fail(): never {
  throw new CommerceInvariantError("ASYNC_FAILURE_INVALID", "Asynchronous payment failure is not verified terminal evidence");
}
export function validateRetrievedStripeAsyncFailureEvidence(
  envelope: StripePaidWebhookEnvelope,
  session: StripePaymentSession,
): VerifiedAsyncFailedEvidence | null {
  if (!envelope || envelope.status!=="VERIFIED" ||
      envelope.eventType!=="checkout.session.async_payment_failed" ||
      !/^evt_[A-Za-z0-9_]{6,}$/.test(envelope.eventId) ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(envelope.providerAccount) ||
      !/^cs_test_[A-Za-z0-9_]+$/.test(envelope.sessionId) ||
      !envelope.attemptId || !envelope.orderId ||
      !session || typeof session!=="object" ||
      session.id!==envelope.sessionId || session.livemode!==false ||
      session.mode!=="payment" || session.status!=="complete" ||
      session.payment_status!=="unpaid" ||
      session.client_reference_id!==envelope.attemptId ||
      session.metadata?.attemptId!==envelope.attemptId ||
      session.metadata?.orderId!==envelope.orderId ||
      !session.metadata?.organizationId || !session.metadata?.storeId ||
      !session.metadata?.connectionId ||
      !Number.isSafeInteger(session.amount_total) ||
      (session.amount_total ?? 0)<1 || (session.amount_total ?? 0)>2147483647 ||
      !/^[a-z]{3}$/.test(session.currency ?? "")) fail();

  const intent=session.payment_intent;
  // Missing or unexpanded intent is not actionable; re-fetch/reconcile later.
  if (intent===null || typeof intent==="string") return null;
  if (typeof intent!=="object" ||
      !/^pi_[A-Za-z0-9_]+$/.test(intent.id) || intent.livemode!==false ||
      !Number.isSafeInteger(intent.amount_received) || intent.amount_received!==0 ||
      intent.currency!==session.currency ||
      intent.metadata?.attemptId!==envelope.attemptId ||
      intent.metadata?.orderId!==envelope.orderId ||
      intent.metadata?.organizationId!==session.metadata.organizationId ||
      intent.metadata?.storeId!==session.metadata.storeId ||
      intent.metadata?.connectionId!==session.metadata.connectionId) fail();

  // Failed attempts on an active/retryable PaymentIntent are not final.
  if (["processing","requires_payment_method","requires_confirmation",
       "requires_action","requires_capture"].includes(intent.status)) return null;
  if (intent.status!=="canceled") fail();
  return {provider:"stripe",eventId:envelope.eventId,providerAccount:envelope.providerAccount,
    sessionId:session.id,attemptId:envelope.attemptId,orderId:envelope.orderId,
    amountMinor:session.amount_total!,currency:session.currency!.toUpperCase()};
}
