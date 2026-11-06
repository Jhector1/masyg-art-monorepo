import Stripe from "stripe";
import { prisma } from "@acme/core/lib/prisma";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { validateRetrievedStripeExpiredEvidence } from "@acme/core/lib/stripe-closed-evidence";
import { closeVerifiedExpiredCheckout } from "@acme/core/lib/stripe-closed-ledger";
import { verifySignedStripeTestWebhook } from "./stripe-webhook-verification";

/** Internal, test-only Stripe Connect expiration reconciler. Does not expose
 * a route, release on the raw webhook, or handle async_payment_failed.
 */
export async function reconcileSignedStripeTestExpiration(args:{
  rawBody:string|Buffer;signature:string;webhookSecret:string;platformTestKey:string;
}) {
  const verified=verifySignedStripeTestWebhook(args);
  if(verified.status==="IGNORED")return {status:"IGNORED" as const};
  if(verified.eventType!=="checkout.session.expired")return {status:"DEFERRED" as const};
  const registered=await prisma.checkoutAttempt.findFirst({where:{
    id:verified.attemptId,orderId:verified.orderId,providerSessionId:verified.sessionId,
    connection:{provider:"stripe",accountRef:verified.providerAccount,status:"VERIFIED"},
  },select:{id:true,organizationId:true,storeId:true,orderId:true,connectionId:true,
    connection:{select:{verifiedAt:true,capabilities:true}}}});
  if(!registered || !registered.connection.verifiedAt ||
     !registered.connection.capabilities.includes("payments")) {
    throw new CommerceInvariantError("STRIPE_CLOSURE_UNKNOWN","Expired session not registered to merchant");
  }
  const stripe=new Stripe(args.platformTestKey);
  const session=await stripe.checkout.sessions.retrieve(verified.sessionId,
    {expand:["payment_intent"]},{stripeAccount:verified.providerAccount});
  if(session.metadata?.organizationId!==registered.organizationId ||
     session.metadata?.storeId!==registered.storeId ||
     session.metadata?.connectionId!==registered.connectionId) {
    throw new CommerceInvariantError("STRIPE_CLOSURE_UNKNOWN","Provider session merchant mismatch");
  }
  return closeVerifiedExpiredCheckout(validateRetrievedStripeExpiredEvidence(verified,
    session as Parameters<typeof validateRetrievedStripeExpiredEvidence>[1]));
}
