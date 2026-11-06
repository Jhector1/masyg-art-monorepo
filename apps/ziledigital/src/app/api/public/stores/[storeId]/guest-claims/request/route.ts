// Only Next.js routing metadata lives here; all logic stays in @acme/server.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@acme/server/api/public/stores/[storeId]/guest-claims/request/route";
