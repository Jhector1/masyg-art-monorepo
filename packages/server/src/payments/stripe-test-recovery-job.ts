import Stripe from "stripe";
import {prisma} from "@acme/core/lib/prisma";
import {CommerceInvariantError} from "@acme/core/lib/commerce-invariants";
import {assertStripeTestCredential} from "@acme/core/lib/stripe-checkout-contract";
import {validateRecoveredStripePaidEvidence} from "@acme/core/lib/stripe-recovery-evidence";
import {settleVerifiedPaidCheckout} from "@acme/core/lib/stripe-payment-ledger";

/** Local development only. No live key, no Stripe mutation and no checkout creation. */
export function assertTestRecoveryEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if(env.NODE_ENV === "production" || env.ZILEDIGITAL_STRIPE_TEST_CHECKOUT_ENABLED !== "true" ||
      env.ZILEDIGITAL_STRIPE_TEST_RECOVERY_ENABLED !== "true")
    throw new CommerceInvariantError("STRIPE_RECOVERY_DISABLED", "Test recovery is disabled");
  let u: URL;
  try { u = new URL(env.DATABASE_URL || ""); }
  catch { throw new CommerceInvariantError("STRIPE_RECOVERY_DATABASE", "Database identity missing"); }
  if(!["postgresql:","postgres:"].includes(u.protocol) || u.hostname!=="127.0.0.1" ||
      u.port!=="55432" || decodeURIComponent(u.pathname)!=="/haitian_art_store" ||
      u.searchParams.get("schema")!=="ziledigital")
    throw new CommerceInvariantError("STRIPE_RECOVERY_DATABASE", "Not the authorized local test database");
  const key=env.ZILEDIGITAL_STRIPE_TEST_PLATFORM_KEY || "";
  if(!/^sk_test_[A-Za-z0-9]{8,}$/.test(key))
    throw new CommerceInvariantError("STRIPE_RECOVERY_CREDENTIAL", "Stripe TEST platform key required");
  return key;
}

/** A bounded scheduler operation; authoritative Stripe reads precede canonical ledger settlement.
 * SESSION_CREATING stays untouched. No synthetic Stripe event IDs are persisted.
 * Refunded or refund-ambiguous provider payments are blocked pending manual reconciliation.
 */
export async function reconcileLostStripeTestPayments(limit=10) {
  if(!Number.isInteger(limit) || limit<1 || limit>20)throw new Error("Invalid recovery limit");
  const key=assertTestRecoveryEnvironment();
  const identity=await prisma.$queryRaw<Array<{database:string;schema:string}>>
    `SELECT current_database() AS database, current_schema() AS schema`;
  if(identity[0]?.database!=="haitian_art_store" || identity[0]?.schema!=="ziledigital")
    throw new CommerceInvariantError("STRIPE_RECOVERY_DATABASE", "Database identity not verified");
  const stripe=new Stripe(key,{timeout:12000,maxNetworkRetries:0});
  const candidates=await prisma.checkoutAttempt.findMany({where:{
    status:"SESSION_CREATED",providerSessionId:{not:null},
    updatedAt:{lte:new Date(Date.now()-120000)},
    order:{status:"PENDING"},
  },select:{id:true,organizationId:true,storeId:true,orderId:true,connectionId:true,
    status:true,providerSessionId:true,
    connection:{select:{id:true,organizationId:true,provider:true,accountRef:true,
      secretRef:true,status:true,verifiedAt:true,capabilities:true}},
    order:{select:{id:true,organizationId:true,storeId:true,status:true,totalMinor:true,currency:true}}},
    orderBy:{updatedAt:"asc"},take:limit});
  const summary={scanned:candidates.length,recovered:0,alreadySettled:0,awaitingPayment:0,
    closedUnpaid:0,blocked:0,refundReview:0,providerUnavailable:0,errors:0};
  for(const attempt of candidates) {
    // Never reveal buyer data, provider IDs or access tokens in a job response.
    const suffix=attempt.id.slice(-8);
    try {
      if(attempt.connection.secretRef!=="env:ZILEDIGITAL_STRIPE_TEST_PLATFORM_KEY" ||
          !attempt.providerSessionId || attempt.order.status!=="PENDING" ||
          attempt.connection.status!=="VERIFIED" || !attempt.connection.verifiedAt ||
          !attempt.connection.capabilities.includes("payments") ||
          attempt.connection.provider.toLowerCase()!=="stripe") {
        summary.blocked++; continue;
      }
      assertStripeTestCredential(key,attempt.connection.accountRef);
      const opts={stripeAccount:attempt.connection.accountRef};
      let session: Stripe.Checkout.Session;
      try {
        session=await stripe.checkout.sessions.retrieve(attempt.providerSessionId,
          {expand:["payment_intent"]},opts);
      } catch {summary.providerUnavailable++;continue;}
      if(session.payment_status!=="paid") {
        // No financial state transition is permitted for unpaid or ambiguous sessions.
        if(session.payment_status==="unpaid" && session.status==="expired") summary.closedUnpaid++;
        else if(session.payment_status==="unpaid" && ["open","complete"].includes(session.status??""))
          summary.awaitingPayment++;
        else summary.blocked++;
        continue;
      }
      const intent=session.payment_intent;
      if(!intent || typeof intent!=="object") {summary.blocked++;continue;}
      const chargeId=typeof intent.latest_charge==="string"
        ? intent.latest_charge : intent.latest_charge?.id;
      if(!chargeId || !/^ch_[A-Za-z0-9_]+$/.test(chargeId)) {summary.blocked++;continue;}
      let charge:Stripe.Charge,refunds:{data:Stripe.Refund[];has_more:boolean};
      try {
        charge=await stripe.charges.retrieve(chargeId,opts);
        refunds=await stripe.refunds.list({charge:chargeId,limit:1},opts);
      } catch {summary.providerUnavailable++;continue;}
      if(charge.amount_refunded!==0 || charge.refunded || refunds.data.length>0 || refunds.has_more) {
        summary.refundReview++;continue;
      }
      const evidence=validateRecoveredStripePaidEvidence({attempt,session,charge,refunds});
      const settled=await settleVerifiedPaidCheckout(evidence);
      if(settled.replay)summary.alreadySettled++;
      else summary.recovered++;
      console.info("Stripe TEST payment recovery",{attemptSuffix:suffix,
        outcome:settled.replay?"ALREADY_SETTLED":"RECOVERED"});
    } catch(error) {
      // Ledger and verification failures are not auto-retried with another checkout.
      summary.blocked++;
      summary.errors++;
      console.error("Stripe TEST recovery blocked",{attemptSuffix:suffix,
        errorCode:error instanceof CommerceInvariantError?error.code:"RECOVERY_ERROR"});
    }
  }
  return summary;
}
