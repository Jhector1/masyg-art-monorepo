/** Authenticated prepared-checkout expiry; route config is statically declared for Next.js. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@acme/server/api/integrations/commerce/expire-prepared/route";
