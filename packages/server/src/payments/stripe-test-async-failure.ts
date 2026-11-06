import Stripe from "stripe";
import { prisma } from "@acme/core/lib/prisma";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { validateRetrievedStripeAsyncFailureEvidence } from "@acme/core/lib/stripe-async-failed-evidence";
import { closeVerifiedAsyncFailedCheckout } from "@acme/core/lib/stripe-closed-ledger";
import { verifySignedStripeTestWebhook } from "./stripe-webhook-verification";

/** Internal only. Raw signed failure events never directly cancel orders.
 * A TEST connected-account retrieval must establish terminal cancellation.
 */
export async function reconcileSignedStripeTestAsyncFailure(args:{
  rawBody:string|Buffer;signature:string;webhookSecret:string;platformTestKey:string;
}) {
  const verified=verifySignedStripeTestWebhook(args);
  if (verified.status==="IGNORED") return {status:"IGNORED" as const};
  if (verified.eventType!=="checkout.session.async_payment_failed") return {status:"DEFERRED" as const};
  const registered=await prisma.checkoutAttempt.findFirst({where:{
    id:verified.attemptId,orderId:verified.orderId,providerSessionId:verified.sessionId,
    connection:{provider:"stripe",accountRef:verified.providerAccount,status:"VERIFIED"},
  },select:{id:true,organizationId:true,storeId:true,orderId:true,connectionId:true,
    connection:{select:{verifiedAt:true,capabilities:true}}}});
  if (!registered || !registered.connection.verifiedAt ||
      !registered.connection.capabilities.includes("payments")) {
    throw new CommerceInvariantError("ASYNC_FAILURE_UNKNOWN", "Checkout not registered to an active merchant account");
  }
  const stripe=new Stripe(args.platformTestKey);
  const session=await stripe.checkout.sessions.retrieve(verified.sessionId,
    {expand:["payment_intent"]},{stripeAccount:verified.providerAccount});
  if(session.metadata?.organizationId!==registered.organizationId ||
     session.metadata?.storeId!==registered.storeId ||
     session.metadata?.connectionId!==registered.connectionId) {
    throw new CommerceInvariantError("ASYNC_FAILURE_UNKNOWN", "Provider merchant ownership mismatch");
  }
  const evidence=validateRetrievedStripeAsyncFailureEvidence(verified,
    session as Parameters<typeof validateRetrievedStripeAsyncFailureEvidence>[1]);
  if (!evidence) return {status:"AWAITING_TERMINAL" as const};
  return closeVerifiedAsyncFailedCheckout(evidence);
}
