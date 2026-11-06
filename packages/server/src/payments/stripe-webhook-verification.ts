import Stripe from "stripe";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { assertStripeTestCredential } from "@acme/core/lib/stripe-checkout-contract";

/** Internal signature verification only, NOT a public endpoint or fulfillment handler.
 * Connect event.account is required; anonymous platform events are not tenant payments.
 * Never choose the merchant from an unverified JSON payload.
 */
export function verifySignedStripeTestWebhook(args:{
  rawBody:string|Buffer; signature:string; webhookSecret:string; platformTestKey:string;
}) {
  const {rawBody,signature,webhookSecret,platformTestKey}=args;
  if ((typeof rawBody!=="string" && !Buffer.isBuffer(rawBody)) ||
      typeof signature!=="string" || !signature ||
      typeof webhookSecret!=="string" || !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret) ||
      typeof platformTestKey!=="string" || !/^sk_test_[A-Za-z0-9]{8,}$/.test(platformTestKey)) {
    throw new CommerceInvariantError("STRIPE_WEBHOOK_INVALID", "Stripe test webhook configuration invalid");
  }
  const stripe=new Stripe(platformTestKey);
  // Raw body exactly as received. Stripe's SDK validates HMAC and timestamp.
  const event=stripe.webhooks.constructEvent(rawBody,signature,webhookSecret);
  if (event.livemode!==false || !event.account) {
    throw new CommerceInvariantError("STRIPE_WEBHOOK_INVALID", "Connected-account test webhook required");
  }
  assertStripeTestCredential(platformTestKey,event.account);
  const supported=["checkout.session.completed","checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed","checkout.session.expired"];
  if (!supported.includes(event.type)) {
    return {status:"IGNORED" as const,eventId:event.id,providerAccount:event.account};
  }
  const session=event.data.object as Stripe.Checkout.Session;
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(session.id) || session.livemode!==false ||
      session.mode!=="payment" || !session.client_reference_id ||
      !session.metadata?.attemptId || !session.metadata?.orderId) {
    throw new CommerceInvariantError("STRIPE_WEBHOOK_INVALID", "Stripe session event is not a trusted checkout");
  }
  // Return a verification envelope ONLY. The next phase must resolve its merchant
  // and retrieve authoritative session/payment status before writing Payment or Order.
  return {status:"VERIFIED" as const,eventId:event.id,eventType:event.type,
    providerAccount:event.account,sessionId:session.id,
    attemptId:session.metadata.attemptId,orderId:session.metadata.orderId};
}
