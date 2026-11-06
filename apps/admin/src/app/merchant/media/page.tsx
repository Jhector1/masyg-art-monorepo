import Link from "next/link";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { listMerchantProducts } from "@acme/core/lib/tenancy";
import { StoreSelect } from "@/components/merchant/shared";
import { productHref } from "@/lib/merchant-navigation";
export const dynamic = "force-dynamic";
export default async function MediaLibrary({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  const products = await listMerchantProducts({ userId, organizationId: store.organizationId, storeId: store.storeId });
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Media library</h1><p className="mt-1 text-sm text-zinc-500">Public, watermarked images for products in this storefront. Private digital originals are accessible only within each product editor.</p></div><StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/media"/>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map(item => <Link key={item.product.id} href={productHref(store.storeId, item.product.id)} className="rounded-xl border bg-white p-4 shadow-sm hover:border-zinc-400"><div className="grid grid-cols-3 gap-2">{item.product.media.slice(0, 3).map((m, i) => <div key={m.asset.id} className="relative aspect-square overflow-hidden rounded-lg border bg-amber-50"><img className="h-full w-full object-cover" src={`/api/merchant/organizations/${store.organizationId}/products/${item.product.id}/media/${m.asset.id}?size=thumb`} alt={`${item.product.title} thumbnail ${i+1}`} />{i === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/75 text-center text-[10px] text-white">Cover</span>}</div>)}{!item.product.media.length && <div className="col-span-3 grid aspect-[3/1] place-items-center rounded-lg bg-zinc-50 text-xs text-zinc-400">No images</div>}</div><h2 className="mt-3 font-semibold">{item.product.title}</h2><p className="text-xs text-zinc-500">{item.product.media.length} image(s) · Manage gallery</p></Link>)}
    </div><p className="text-xs text-zinc-500">Showing media for the latest 50 store listings. A fully paginated organization-wide library will follow.</p>
  </div>;
}
