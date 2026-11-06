import Stripe from "stripe";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { reconcileSignedStripeTestPayment } from "./stripe-test-reconciler";
import { reconcileSignedStripeTestExpiration } from "./stripe-test-expiration";
import { reconcileSignedStripeTestAsyncFailure } from "./stripe-test-async-failure";
import { reconcileSignedStripeTestFullRefund } from "./stripe-test-refunds";

/** One commerce-api endpoint, one platform Stripe Connect webhook secret.
 * Raw body signature and timestamp are checked before looking up merchant state.
 * Provider retrieval + idempotent DB settlement are handled by existing modules.
 */
export function classifyStripeTestEvent(type:string) {
  if (["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(type)) return "PAID" as const;
  if (type==="checkout.session.expired") return "EXPIRED" as const;
  if (type==="checkout.session.async_payment_failed") return "ASYNC_FAILURE" as const;
  if (type==="charge.refunded") return "FULL_REFUND" as const;
  return "IGNORED" as const;
}
export async function dispatchSignedStripeTestWebhook(args:{
  rawBody:string|Buffer;signature:string;webhookSecret:string;platformTestKey:string;
}) {
  if (!/^sk_test_[A-Za-z0-9]{8,}$/.test(args.platformTestKey) ||
      !/^whsec_[A-Za-z0-9]+$/.test(args.webhookSecret) || !args.signature)
    throw new CommerceInvariantError("TEST_WEBHOOK_NOT_CONFIGURED","Test Stripe webhook secrets missing");
  const stripe=new Stripe(args.platformTestKey);
  const event=stripe.webhooks.constructEvent(args.rawBody,args.signature,args.webhookSecret);
  if(event.livemode!==false || !event.account || !/^acct_[A-Za-z0-9]{6,}$/.test(event.account))
    throw new CommerceInvariantError("WEBHOOK_ACCOUNT_INVALID","Test connected-account webhook required");
  const operation=classifyStripeTestEvent(event.type);
  if(operation==="IGNORED") return {status:"IGNORED" as const};
  if(operation==="FULL_REFUND") return reconcileSignedStripeTestFullRefund(event,args.platformTestKey);
  const params={rawBody:args.rawBody,signature:args.signature,
    webhookSecret:args.webhookSecret,platformTestKey:args.platformTestKey};
  if(operation==="PAID") return reconcileSignedStripeTestPayment(params);
  if(operation==="EXPIRED") return reconcileSignedStripeTestExpiration(params);
  const outcome=await reconcileSignedStripeTestAsyncFailure(params);
  // An unsettled failed async payment must be retrieved again before releasing stock.
  if(outcome.status==="AWAITING_TERMINAL")
    throw new CommerceInvariantError("PROVIDER_RECONCILIATION_REQUIRED","Asynchronous payment is not terminal");
  return outcome;
}
