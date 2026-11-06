/** Centralized Stripe webhook. Route segment configuration must be statically declared for Next.js. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@acme/server/api/integrations/stripe/test-webhook/route";
