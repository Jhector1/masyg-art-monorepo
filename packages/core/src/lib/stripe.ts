// import Stripe from "stripe";

import StripeSDK from "stripe";

const key = process.env.NEXT_STRIPE_SECRET_KEY;

if (!key) {
  throw new Error("❌ NEXT_STRIPE_SECRET_KEY is missing. Please check your environment variables.");
}

export const stripe = new StripeSDK(key, {
  apiVersion: "2025-08-27.basil",
});
