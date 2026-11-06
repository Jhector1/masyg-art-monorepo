// Storefront-agnostic domain-to-tenant adapter. No app-owned business logic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { GET } from "@acme/server/api/public/store-context/route";
