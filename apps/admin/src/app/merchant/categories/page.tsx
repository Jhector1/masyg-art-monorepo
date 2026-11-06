import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { listMerchantCategories } from "@acme/core/lib/merchant-categories";
import { StoreSelect } from "@/components/merchant/shared";
import CategoryManager from "@/components/merchant/CategoryManager";
export const dynamic = "force-dynamic";
export default async function CategoriesPage({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No authorized storefronts.</p>;
  const categories = await listMerchantCategories(userId, store.organizationId);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Categories</h1><p className="mt-1 text-sm text-zinc-500">Organize artwork across stores in this organization.</p></div>
    <StoreSelect pathname="/merchant/categories" stores={stores} selected={store.storeId}/>
    <CategoryManager store={store} categories={categories}/></div>;
}
