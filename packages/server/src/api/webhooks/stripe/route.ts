import { createStripeWebhookPostHandler } from "../../../billing/stripe-webhook";
import { handleOrderFulfillment } from "@acme/core/helpers/stripe/webhook/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createStripeWebhookPostHandler({
  logPrefix: "ZILEDIGITAL_STRIPE_WEBHOOK",
  onCheckoutCompleted: async (session) => {
    await handleOrderFulfillment(session);
  },
});
