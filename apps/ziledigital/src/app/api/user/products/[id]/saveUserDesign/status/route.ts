// Canonical implementation lives in @acme/server.
// Keep route-segment config literal in this app file when required by Next.js.
export const dynamic = "force-dynamic";

export { GET } from "@acme/server/api/products/[id]/saveUserDesign/status/route";
