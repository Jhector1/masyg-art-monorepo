// Expose the canonical, signature-verified Stripe Connect TEST webhook.
// Reconciliation and event authorization remain in @acme/server.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { POST } from "@acme/server/api/integrations/stripe/test-webhook/route";
