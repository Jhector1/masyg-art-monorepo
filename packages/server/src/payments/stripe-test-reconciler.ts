import Stripe from "stripe";
import {prisma} from "@acme/core/lib/prisma";
import {CommerceInvariantError} from "@acme/core/lib/commerce-invariants";
import {validateRetrievedStripePaidEvidence} from "@acme/core/lib/stripe-paid-evidence";
import {settleVerifiedPaidCheckout} from "@acme/core/lib/stripe-payment-ledger";
import {verifySignedStripeTestWebhook} from "./stripe-webhook-verification";

/** Internal signed + provider-retrieved Stripe Connect test reconciliation.
 * Do NOT expose via public route until DB integration + webhook replay tests pass.
 * The event payload is never allowed to select a tenant by metadata alone.
 */
export async function reconcileSignedStripeTestPayment(args:{
  rawBody:string|Buffer;signature:string;webhookSecret:string;platformTestKey:string;
}) {
  const verified=verifySignedStripeTestWebhook(args);
  if(verified.status==="IGNORED")return {status:"IGNORED" as const};
  if(verified.eventType!=="checkout.session.completed" &&
     verified.eventType!=="checkout.session.async_payment_succeeded") {
    // Expired and failed events need a separate reconciliation path that first
    // verifies final provider status; never release stock from webhook JSON.
    return {status:"DEFERRED" as const};
  }
  const registered=await prisma.checkoutAttempt.findFirst({where:{
    id:verified.attemptId,orderId:verified.orderId,providerSessionId:verified.sessionId,
    connection:{provider:"stripe",accountRef:verified.providerAccount,status:"VERIFIED"},
  },select:{id:true,organizationId:true,storeId:true,orderId:true,connectionId:true,
    connection:{select:{accountRef:true,capabilities:true,verifiedAt:true}},
  }});
  if(!registered || !registered.connection.verifiedAt ||
     !registered.connection.capabilities.includes("payments")) {
    throw new CommerceInvariantError("STRIPE_PAYMENT_UNKNOWN","Signed event is not registered to a verified merchant checkout");
  }
  const stripe=new Stripe(args.platformTestKey);
  const retrieved=await stripe.checkout.sessions.retrieve(verified.sessionId,
    {expand:["payment_intent"]},{stripeAccount:verified.providerAccount});
  if(retrieved.metadata?.organizationId!==registered.organizationId ||
     retrieved.metadata?.storeId!==registered.storeId ||
     retrieved.metadata?.connectionId!==registered.connectionId) {
    throw new CommerceInvariantError("STRIPE_PAYMENT_UNKNOWN","Provider session has incorrect merchant ownership");
  }
  const evidence=validateRetrievedStripePaidEvidence(verified,
    retrieved as Parameters<typeof validateRetrievedStripePaidEvidence>[1]);
  if(!evidence)return {status:"AWAITING_PAYMENT" as const};
  return settleVerifiedPaidCheckout(evidence);
}
