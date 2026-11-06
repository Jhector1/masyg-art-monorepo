import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { dispatchSignedStripeTestWebhook } from "../../../../payments/stripe-test-webhook-controller";
import { readBoundedWebhookBody, WebhookBodyTooLargeError } from "../../../../lib/bounded-webhook-body";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","Content-Type":"application/json"};
const LIMIT=256*1024;
/** Accept only signed Stripe Connect TEST webhooks; never trust client-supplied account IDs. */
export async function POST(req:NextRequest) {
  const signature=req.headers.get("stripe-signature")??"";
  // A missing server-side secret is retryable unavailability; an unsigned request is not.
  if(!process.env.ZILEDIGITAL_STRIPE_TEST_WEBHOOK_SECRET ||
     !process.env.ZILEDIGITAL_STRIPE_TEST_PLATFORM_KEY)
    return Response.json({error:"Unavailable"},{status:503,headers});
  if(!signature)
    return Response.json({error:"Invalid webhook signature"},{status:400,headers});
  if(Number(req.headers.get("content-length")||0)>LIMIT)
    return Response.json({error:"Too large"},{status:413,headers});
  try {
    // Bound memory while receiving the body, even when Content-Length is absent or false.
    // Preserve exact bytes for Stripe HMAC verification.
    const raw=await readBoundedWebhookBody(req,LIMIT);
    const result=await dispatchSignedStripeTestWebhook({rawBody:raw,signature,
      webhookSecret:process.env.ZILEDIGITAL_STRIPE_TEST_WEBHOOK_SECRET,
      platformTestKey:process.env.ZILEDIGITAL_STRIPE_TEST_PLATFORM_KEY});
    return Response.json({received:true,status:result.status},{status:200,headers});
  } catch(error) {
    if(error instanceof WebhookBodyTooLargeError)
      return Response.json({error:"Too large"},{status:413,headers});
    // Cryptographic signature failure and invalid Connect envelope are permanent
    // request errors. Never acknowledge them, but do not ask Stripe to retry.
    if(error instanceof Stripe.errors.StripeSignatureVerificationError ||
       (error instanceof CommerceInvariantError && error.code==="WEBHOOK_ACCOUNT_INVALID"))
      return Response.json({error:"Invalid webhook signature or event"},{status:400,headers});
    // Configuration, provider and DB uncertainty must remain retryable 5xx.
    console.error("Stripe webhook reconciliation refused",error instanceof Error?error.name:"unknown");
    return Response.json({error:"Webhook not settled"},{status:503,headers});
  }
}
