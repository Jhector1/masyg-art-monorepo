import Link from "next/link";
import { notFound } from "next/navigation";
import { merchantWorkspace } from "@/lib/merchant-workspace";
import { listMerchantCustomers } from "@acme/core/lib/merchant-orders-customers";
import { StoreSelect } from "@/components/merchant/shared";
import { dateTime, Pager } from "@/components/merchant/CommerceRecords";
import { storeQuery } from "@/lib/merchant-navigation";
export const dynamic = "force-dynamic";
export default async function Customers({ searchParams }: { searchParams: Promise<{ store?: string; page?: string }> }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  if (store.role === "MEMBER") notFound();
  const snapshot = await listMerchantCustomers({ userId, organizationId: store.organizationId, storeId: store.storeId, page: Number((await searchParams).page || "1") });
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Customers</h1><p className="mt-1 text-sm text-zinc-500">Customers with purchases in this storefront. Profiles belong to your organization; order history is scoped to the selected store.</p></div><StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/customers"/>
    <section className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><p className="border-b px-5 py-4 text-sm font-medium">{snapshot.total} customers</p><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr>{["Customer", "Email", "Orders in store", "First recorded (UTC)"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y">{snapshot.rows.map(c => <tr key={c.id}><td className="px-4 py-3 font-semibold"><Link className="underline decoration-zinc-300 underline-offset-4" href={`/merchant/customers/${c.id}${storeQuery(store.storeId)}`}>{c.name || "Customer"}</Link></td><td className="px-4 py-3">{c.email}</td><td className="px-4 py-3">{c._count.orders}</td><td className="px-4 py-3 text-zinc-500">{dateTime(c.createdAt)}</td></tr>)}</tbody></table>{!snapshot.rows.length && <p className="p-6 text-sm text-zinc-500">No customers with orders in this storefront yet.</p>}</section>
    <Pager base="/merchant/customers" storeId={store.storeId} page={snapshot.page} pages={snapshot.pages}/>
  </div>;
}
