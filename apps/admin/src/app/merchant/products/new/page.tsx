import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { StoreSelect } from "@/components/merchant/shared";
import ProductCreate from "@/components/merchant/ProductCreate";
export const dynamic = "force-dynamic";
export default async function NewProduct({ searchParams }: { searchParams: MerchantSearch }) {
  const { stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Create product</h1><p className="mt-1 text-sm text-zinc-500">Products start in draft. After creation you can upload artwork previews, thumbnails and private files.</p></div><StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/products/new"/><ProductCreate store={store}/></div>;
}
