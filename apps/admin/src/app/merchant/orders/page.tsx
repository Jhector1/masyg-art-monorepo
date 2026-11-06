import Link from "next/link";
import { merchantWorkspace } from "@/lib/merchant-workspace";
import { listMerchantOrders } from "@acme/core/lib/merchant-orders-customers";
import { StoreSelect } from "@/components/merchant/shared";
import { RecordPill, money, dateTime, Pager } from "@/components/merchant/CommerceRecords";
import { storeQuery } from "@/lib/merchant-navigation";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
type Query = Promise<{ store?: string; page?: string; status?: string }>;
const statuses = ["ALL", "PENDING", "PAID", "FULFILLING", "FULFILLED", "CANCELLED", "REFUNDED"];
export default async function Orders({ searchParams }: { searchParams: Query }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  if (store.role === "MEMBER") notFound();
  const query = await searchParams; const status = statuses.includes(query.status || "") ? query.status! : "ALL";
  const snapshot = await listMerchantOrders({ userId, organizationId: store.organizationId, storeId: store.storeId,
    page: Number(query.page || "1"), status: status === "ALL" ? undefined : status });
  const path = `/merchant/orders${storeQuery(store.storeId)}`;
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Orders</h1><p className="mt-1 text-sm text-zinc-500">Read-only verified order records. Payment, refunds and fulfillment are not editable here.</p></div>
    <StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/orders" />
    <div className="flex flex-wrap gap-2">{statuses.map(s => <Link key={s} href={`${path}&status=${s}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${s === status ? "bg-zinc-900 text-white" : "border bg-white"}`}>{s}</Link>)}</div>
    <section className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4 text-sm font-medium">{snapshot.total} orders · {store.storeName}</div><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr>{["Order", "Customer", "Created (UTC)", "Items", "Status", "Total"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y">{snapshot.rows.map(o => <tr key={o.id}><td className="px-4 py-3 font-semibold"><Link className="underline decoration-zinc-300 underline-offset-4" href={`/merchant/orders/${encodeURIComponent(o.id)}${storeQuery(store.storeId)}`}>{o.id.slice(0, 13)}…</Link></td><td className="px-4 py-3">{o.customer?.name || o.customer?.email || "Guest"}</td><td className="px-4 py-3 text-zinc-500">{dateTime(o.createdAt)}</td><td className="px-4 py-3">{o._count.items}</td><td className="px-4 py-3"><RecordPill status={o.status}/></td><td className="px-4 py-3 font-semibold">{money(o.totalMinor,o.currency)}</td></tr>)}</tbody></table>{snapshot.rows.length === 0 && <p className="p-6 text-sm text-zinc-500">No orders match this filter. The Admin does not create sample orders.</p>}</section>
    <Pager base="/merchant/orders" storeId={store.storeId} page={snapshot.page} pages={snapshot.pages} extra={status === "ALL" ? "" : `&status=${status}`}/>
  </div>;
}
