import Link from "next/link";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { listMerchantInventory } from "@acme/core/lib/merchant-inventory";
import { StoreSelect } from "@/components/merchant/shared";
import InventoryManager from "@/components/merchant/InventoryManager";
import { storeQuery } from "@/lib/merchant-navigation";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No authorized storefronts.</p>;
  const snapshot = await listMerchantInventory({ userId, organizationId: store.organizationId, storeId: store.storeId });

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="space-y-2">
      <Link href={`/merchant${storeQuery(store.storeId)}`} className="inline-flex text-sm font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">← {store.storeName} workspace</Link>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Store workspace / Inventory</p>
      <h1 className="text-3xl font-bold tracking-tight">Manage physical stock</h1>
      <p className="max-w-3xl text-sm text-zinc-600">Choose a stock location, then record units received or removed. Inventory is shared across the organization; this view shows physical products listed in {store.storeName}.</p>
    </div>
    <StoreSelect pathname="/merchant/inventory" stores={stores} selected={store.storeId} />
    <InventoryManager key={`${store.organizationId}:${store.storeId}`} store={store} snapshot={snapshot} />
  </div>;
}
