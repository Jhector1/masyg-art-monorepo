// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@acme/core/lib/stripe";
import { isSessionCompleted, alreadyProcessed, markProcessed } from "@acme/core/helpers/stripe/webhook/utils";
import { isQuotaTopup, handleQuotaTopup } from "@acme/core/helpers/stripe/webhook/quota";
import { handleOrderFulfillment } from "@acme/core/helpers/stripe/webhook/orders";

export const runtime = "nodejs";          // required for raw body
export const dynamic = "force-dynamic";   // never cache

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing Stripe-Signature header", { status: 400 });
  }

  const webhookSecret = process.env.NEXT_STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Fail fast if misconfigured
    return new NextResponse("Missing NEXT_STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  // IMPORTANT: pass the exact raw bytes to Stripe
  const rawBuf = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBuf, signature, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err?.message || err);
    return new NextResponse(`Webhook Error: ${err?.message || "invalid signature"}`, { status: 400 });
  }

  // Fast-path non-target events
  if (!isSessionCompleted(event)) {
    return NextResponse.json({ received: true });
  }

  // Event-level idempotency (defensive against Stripe retries)
  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, deduped: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    if (isQuotaTopup(session)) {
      await handleQuotaTopup(session);
    } else {
      await handleOrderFulfillment(session);
    }

    // Mark processed only after successful commit in handlers
    await markProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (e: any) {
    // Handlers themselves are guarded with db-level idempotency (unique keys / tryClaimIdempotencyTx).
    // Still return 500 so Stripe can retry if it wasn't a clean no-op.
    console.error("❌ Webhook processing error:", e?.message || e);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
