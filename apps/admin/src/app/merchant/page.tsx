import Link from "next/link";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { listMerchantProducts } from "@acme/core/lib/tenancy";
import { StoreSelect, Status } from "@/components/merchant/shared";
import { storeQuery } from "@/lib/merchant-navigation";
export const dynamic = "force-dynamic";
export default async function MerchantOverview({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <div className="space-y-3 rounded-2xl border bg-white p-8">
    <p>No storefronts are assigned to this account.</p>
    <Link href="/merchant/onboarding" className="inline-block rounded-xl bg-zinc-900 px-4 py-2 text-white">Create a storefront</Link>
  </div>;
  const products = await listMerchantProducts({ userId, organizationId: store.organizationId, storeId: store.storeId });
  const live = products.filter(p => p.status === "PUBLISHED" && p.product.status === "PUBLISHED").length;
  const q = storeQuery(store.storeId);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">Merchant overview</h1><p className="mt-1 text-sm text-zinc-500">Manage each storefront from dedicated catalog, media and publication pages.</p></div>
    <StoreSelect pathname="/merchant" stores={stores} selected={store.storeId}/>
    <div className="text-right"><Link href="/merchant/security" className="text-sm underline">Two-factor authentication settings</Link></div>
    <div className="grid gap-4 sm:grid-cols-3">{[
      { title: "Recent listings", count: products.length, detail: "Up to 50" },
      { title: "Published listings", count: live, detail: "Catalog and listing published" },
      { title: "Product previews", count: products.reduce((n,p) => n + p.product.media.length, 0), detail: "Watermarked gallery images" },
    ].map(x => <div key={x.title} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-xs text-zinc-500">{x.title}</p><p className="mt-2 text-3xl font-semibold">{x.count}</p><p className="mt-2 text-xs text-zinc-400">{x.detail}</p></div>)}</div>
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border bg-white p-6 shadow-sm"><div><h2 className="text-lg font-semibold">{store.storeName}</h2><div className="mt-2 flex items-center gap-2"><Status value={store.published ? "PUBLISHED" : "DRAFT"}/><span className="text-xs text-zinc-500">{store.organizationName} · {store.role}</span></div></div><Link href={`/merchant/storefronts${q}`} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Manage storefront</Link></section>
    <div className="grid gap-4 md:grid-cols-3">{[
      { href: `/merchant/products${q}`, title: "Products", sub: "Search catalog, edit and publish" },
      { href: `/merchant/products/new${q}`, title: "Add product", sub: "Sizes, materials, prices, digital" },
      { href: `/merchant/media${q}`, title: "Media library", sub: "Cover art, thumbnails and files" },
      { href: `/merchant/categories${q}`, title: "Categories", sub: "Organize products across storefronts" },
      { href: `/merchant/inventory${q}`, title: "Inventory", sub: "Stock, locations and adjustments" },
      { href: `/merchant/orders${q}`, title: "Orders", sub: "Recorded payment and fulfillment state" },
      { href: `/merchant/customers${q}`, title: "Customers", sub: "Buyer profiles and store order history" },
      { href: `/merchant/staff${q}`, title: "Staff", sub: "Organization membership and roles" },
    ].map(item => <Link key={item.title} href={item.href} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-zinc-400"><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm text-zinc-500">{item.sub}</p></Link>)}</div>
  </div>;
}
