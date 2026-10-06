import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@acme/core/lib/stripe";
import {
  alreadyProcessed,
  isSessionCompleted,
  markProcessed,
} from "@acme/core/helpers/stripe/webhook/utils";
import {
  handleQuotaTopup,
  isQuotaTopup,
} from "@acme/core/helpers/stripe/webhook/quota";

type SessionHandler = (
  session: Stripe.Checkout.Session,
  event: Stripe.Event
) => Promise<void>;

export type StripeWebhookHandlers = {
  onCheckoutCompleted?: SessionHandler;
  onCheckoutExpired?: SessionHandler;
  logPrefix?: string;
};

/**
 * Canonical Stripe webhook envelope shared by every storefront.
 *
 * Guarantees:
 * - raw-body signature verification before any side effect
 * - a configured webhook secret is mandatory
 * - event-level idempotency
 * - quota top-ups are handled identically by every storefront
 * - an event is marked processed only after its handler succeeds
 * - failures return 500 so Stripe can retry
 */
export function createStripeWebhookPostHandler(
  handlers: StripeWebhookHandlers
) {
  const prefix = handlers.logPrefix ?? "STRIPE_WEBHOOK";

  return async function POST(req: NextRequest) {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "missing_stripe_signature" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.NEXT_STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      console.error(`[${prefix}] missing NEXT_STRIPE_WEBHOOK_SECRET`);
      return NextResponse.json(
        { error: "webhook_not_configured" },
        { status: 500 }
      );
    }

    const rawBody = Buffer.from(await req.arrayBuffer());

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
    } catch (error: any) {
      console.error(
        `[${prefix}] signature verification failed`,
        error?.message || error
      );
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }

    const completed = isSessionCompleted(event);
    const expired = event.type === "checkout.session.expired";

    // Do not fill the idempotency table with Stripe events this integration
    // does not act on. Acknowledge them immediately.
    if (!completed && !expired) {
      return NextResponse.json({ received: true });
    }

    if (await alreadyProcessed(event.id)) {
      return NextResponse.json({ received: true, deduped: true });
    }

    try {
      const session = event.data.object as Stripe.Checkout.Session;

      if (completed) {
        // checkout.session.completed may arrive before an asynchronous payment
        // is actually paid. Never grant goods/credits until Stripe says paid;
        // async_payment_succeeded will arrive later as a separate event.
        if (session.payment_status !== "paid") {
          await markProcessed(event.id);
          return NextResponse.json({ received: true, deferred: true });
        }

        if (isQuotaTopup(session)) {
          await handleQuotaTopup(session);
        } else {
          await handlers.onCheckoutCompleted?.(session, event);
        }
      } else if (expired) {
        await handlers.onCheckoutExpired?.(session, event);
      }

      await markProcessed(event.id);
      return NextResponse.json({ received: true });
    } catch (error: any) {
      console.error(
        `[${prefix}] handler failed`,
        event.type,
        error?.message || error
      );
      return NextResponse.json({ error: "handler_failed" }, { status: 500 });
    }
  };
}
