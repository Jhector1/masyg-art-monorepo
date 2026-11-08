import Link from "next/link";
import { storeQuery } from "@/lib/merchant-navigation";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { listMerchantProducts } from "@acme/core/lib/tenancy";
import { StoreSelect } from "@/components/merchant/shared";
import ProductList from "@/components/merchant/ProductList";
export const dynamic = "force-dynamic";
export default async function Products({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  const products = await listMerchantProducts({ userId, organizationId: store.organizationId, storeId: store.storeId });
  const q = storeQuery(store.storeId);
  return <div className="space-y-6">
    <Link href={`/merchant${q}`} className="inline-flex text-sm font-semibold text-zinc-600 hover:text-zinc-900">← {store.storeName} home</Link>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Products</h1><p className="mt-1 text-sm text-zinc-500">Manage products and editions for {store.storeName}.</p></div>
      {store.role !== "MEMBER" && <Link href={`/merchant/products/new${q}`} className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700">+ Add product</Link>}
    </div>
    <StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/products" />
    {process.env.NODE_ENV === "development" && <Link href={`/merchant/demo-catalog${q}`} className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">Create development test products</Link>}
    <ProductList store={store} listings={products}/>
  </div>;
}
