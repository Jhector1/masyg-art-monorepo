import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { listMerchantInventory } from "@acme/core/lib/merchant-inventory";
import { StoreSelect } from "@/components/merchant/shared";
import InventoryManager from "@/components/merchant/InventoryManager";
export const dynamic = "force-dynamic";
export default async function InventoryPage({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No authorized storefronts.</p>;
  const snapshot = await listMerchantInventory({ userId, organizationId: store.organizationId, storeId: store.storeId });
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Inventory</h1><p className="mt-1 text-sm text-zinc-500">Physical stock, reserved units and locations. Stock is shared across your organization.</p></div>
    <StoreSelect pathname="/merchant/inventory" stores={stores} selected={store.storeId}/>
    <InventoryManager store={store} snapshot={snapshot}/></div>;
}
