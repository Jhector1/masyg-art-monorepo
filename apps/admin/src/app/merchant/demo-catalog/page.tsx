import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@acme/core/lib/prisma";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { StoreSelect } from "@/components/merchant/shared";
import DemoCatalogSeeder from "@/components/merchant/DemoCatalogSeeder";

export const dynamic = "force-dynamic";

/**
 * This page is intentionally LOCAL DEVELOPMENT ONLY. It never writes directly
 * to the database; all changes use the authenticated canonical Merchant APIs.
 */
export default async function DemoCatalogPage({ searchParams }: { searchParams: MerchantSearch }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const url = process.env.DATABASE_URL;
  let localTarget = false;
  try {
    if (url) {
      const parsed = new URL(url);
      localTarget = ["postgres:", "postgresql:"].includes(parsed.protocol)
        && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
        && decodeURIComponent(parsed.pathname) === "/haitian_art_store"
        && parsed.searchParams.get("schema") === "ziledigital";
    }
  } catch { /* Invalid or absent DATABASE_URL: refuse to seed. */ }
  const { stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  // Evaluate permissions on the server. Functions exported from a client
  // module are client references and must never be invoked here.
  const canSeed = store.role === "OWNER" || store.role === "ADMIN";
  let verified = false;
  if (localTarget) {
    try {
      const result = await prisma.$queryRaw<Array<{ database_name: string; schema_name: string }>>`
        SELECT current_database()::text AS database_name, current_schema()::text AS schema_name
      `;
      verified = result[0]?.database_name === "haitian_art_store" && result[0]?.schema_name === "ziledigital";
    } catch { verified = false; }
  }
  const stockLevels = verified && canSeed ? await prisma.inventoryLevel.findMany({
    where: { organizationId: store.organizationId, variant: {
      product: { listings: { some: { organizationId: store.organizationId, storeId: store.storeId, slug: { startsWith: "zd-ui-demo-" } } } },
    } },
    select: { variantId: true, onHand: true },
  }) : [];
  const locations = verified && canSeed ? await prisma.inventoryLocation.findMany({
    where: { organizationId: store.organizationId }, select: { id: true, name: true }, take: 100,
  }) : [];
  const onHand: Record<string, number> = {};
  for (const level of stockLevels) onHand[level.variantId] = (onHand[level.variantId] ?? 0) + level.onHand;
  return <div className="space-y-6">
    <div className="space-y-1">
      <Link className="text-sm text-zinc-600 hover:underline" href="/merchant/products">Back to products</Link>
      <h1 className="text-2xl font-bold">Development preview catalog</h1>
      <p className="text-sm text-zinc-500">Create example physical, digital, mixed and out-of-stock products to check your original storefront UI.</p>
    </div>
    <StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/demo-catalog" />
    {!verified && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      Seeding is disabled. The Admin server must connect to local PostgreSQL database <code>haitian_art_store</code> and schema <code>ziledigital</code> using a loopback DATABASE_URL with ?schema=ziledigital.
    </p>}
    {verified && !canSeed && <p className="rounded-xl bg-amber-50 p-4 text-sm">Only organization owners and admins can create demo products.</p>}
    {verified && canSeed && <DemoCatalogSeeder store={store} initialOnHand={onHand} locations={locations} />}
  </div>;
}
