import Stripe from "stripe";
import { prisma } from "@acme/core/lib/prisma";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { settleVerifiedFullRefund } from "@acme/core/lib/stripe-refund-ledger";

/** Caller has already verified the exact raw Stripe webhook signature. */
export async function reconcileSignedStripeTestFullRefund(event:Stripe.Event,platformTestKey:string) {
  if (event.type!=="charge.refunded" || event.livemode!==false || !event.account ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(event.account))
    throw new CommerceInvariantError("REFUND_EVENT_INVALID","Connected Stripe refund event required");
  const signedCharge=event.data.object as Stripe.Charge;
  if(!/^ch_[A-Za-z0-9_]+$/.test(signedCharge.id))
    throw new CommerceInvariantError("REFUND_EVENT_INVALID","Invalid charge identifier");
  const stripe=new Stripe(platformTestKey);
  const charge=await stripe.charges.retrieve(signedCharge.id,{stripeAccount:event.account});
  if (charge.livemode!==false || charge.status!=="succeeded" ||
      !charge.paid || !charge.refunded || charge.amount_refunded!==charge.amount ||
      !Number.isSafeInteger(charge.amount) || charge.amount<1 ||
      !charge.currency || typeof charge.payment_intent!=="string")
    throw new CommerceInvariantError("REFUND_NOT_FULL","Partial or uncertain refund requires manual reconciliation");
  const intent=await stripe.paymentIntents.retrieve(charge.payment_intent,{stripeAccount:event.account});
  const latest=typeof intent.latest_charge==="string"?intent.latest_charge:intent.latest_charge?.id;
  if (intent.livemode!==false || intent.id!==charge.payment_intent ||
      latest!==charge.id || intent.currency!==charge.currency ||
      intent.amount_received!==charge.amount || !intent.metadata?.organizationId ||
      !intent.metadata?.storeId || !intent.metadata?.orderId || !intent.metadata?.connectionId)
    throw new CommerceInvariantError("REFUND_EVIDENCE_INVALID","Refund does not match verified Stripe intent");
  const connection=await prisma.integrationConnection.findFirst({where:{
    id:intent.metadata.connectionId,organizationId:intent.metadata.organizationId,
    provider:"stripe",accountRef:event.account,status:"VERIFIED",capabilities:{has:"payments"},
  },select:{id:true,verifiedAt:true}});
  if(!connection?.verifiedAt)
    throw new CommerceInvariantError("REFUND_OWNER_MISMATCH","Connected merchant not verified");
  const original=await prisma.payment.findFirst({where:{
    organizationId:intent.metadata.organizationId,orderId:intent.metadata.orderId,
    provider:"stripe",providerAccount:event.account,providerPaymentId:intent.id,
  },select:{order:{select:{storeId:true}},currency:true,amountMinor:true}});
  if(!original || original.order.storeId!==intent.metadata.storeId ||
      original.amountMinor!==charge.amount || original.currency!==charge.currency.toUpperCase())
    throw new CommerceInvariantError("REFUND_OWNER_MISMATCH","Refund does not match stored payment");
  return settleVerifiedFullRefund({eventId:event.id,providerAccount:event.account,
    paymentIntentId:intent.id,chargeId:charge.id,organizationId:intent.metadata.organizationId,
    storeId:intent.metadata.storeId,orderId:intent.metadata.orderId,
    amountMinor:charge.amount,currency:charge.currency.toUpperCase()});
}
