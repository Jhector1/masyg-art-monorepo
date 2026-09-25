// Canonical implementation lives in @acme/server.
// Keep route-segment config literal in this app file when required by Next.js.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { POST } from "@acme/server/api/products/[id]/export/route";
