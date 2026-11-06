// Shared authenticated, tenant-scoped buyer order detail. No storefront-owned access rules.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { GET } from "@acme/server/api/public/stores/[storeId]/orders/[orderId]/route";
