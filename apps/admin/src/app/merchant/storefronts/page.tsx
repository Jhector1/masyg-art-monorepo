import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { StoreSelect } from "@/components/merchant/shared";
import StorefrontPanel from "@/components/merchant/StorefrontPanel";
export const dynamic = "force-dynamic";
export default async function Storefronts({ searchParams }: { searchParams: MerchantSearch }) {
  const { stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Storefronts</h1><p className="mt-1 text-sm text-zinc-500">Manage publication independently from product catalog status.</p></div><StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/storefronts"/><StorefrontPanel store={store}/></div>;
}
