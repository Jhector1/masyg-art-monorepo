import Link from "next/link";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import ProductCreate from "@/components/merchant/ProductCreate";
import { storeQuery } from "@/lib/merchant-navigation";
export const dynamic = "force-dynamic";
export default async function NewProduct({ searchParams }: { searchParams: MerchantSearch }) {
  const { store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link className="inline-flex text-sm font-semibold text-zinc-600 hover:text-zinc-900" href={`/merchant/products${storeQuery(store.storeId)}`}>← Products in {store.storeName}</Link>
    <div><h1 className="text-3xl font-bold tracking-tight">Create a product</h1>
      <p className="mt-2 text-sm text-zinc-500">A few steps, only the fields you need. Products stay in draft until you publish them.</p>
    </div>
    <ProductCreate store={store}/>
  </div>;
}
