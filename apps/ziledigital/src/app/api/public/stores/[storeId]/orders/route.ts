// Thin storefront adapter; commerce implementation lives in @acme/server.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { GET } from "@acme/server/api/public/stores/[storeId]/orders/route";
