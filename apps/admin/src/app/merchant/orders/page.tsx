import Link from "next/link";
import { notFound } from "next/navigation";
import { merchantWorkspace } from "@/lib/merchant-workspace";
import { listMerchantOrders } from "@acme/core/lib/merchant-orders-customers";
import { StoreSelect } from "@/components/merchant/shared";
import { RecordPill, money, dateTime, Pager } from "@/components/merchant/CommerceRecords";
import { storeQuery } from "@/lib/merchant-navigation";

export const dynamic = "force-dynamic";
type Query = Promise<{ store?: string; page?: string; status?: string }>;
const statuses = [
  { value: "ALL", label: "All orders" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FULFILLING", label: "In progress" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
] as const;

export default async function Orders({ searchParams }: { searchParams: Query }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  if (store.role === "MEMBER") notFound();
  const query = await searchParams;
  const selectedStatus = statuses.find(item => item.value === query.status)?.value ?? "ALL";
  const snapshot = await listMerchantOrders({
    userId, organizationId: store.organizationId, storeId: store.storeId,
    page: Number(query.page || "1"), status: selectedStatus === "ALL" ? undefined : selectedStatus,
  });
  const path = `/merchant/orders${storeQuery(store.storeId)}`;

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="space-y-2"><Link href={`/merchant${storeQuery(store.storeId)}`} className="inline-flex text-sm font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-4">← {store.storeName} workspace</Link>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Store workspace / Orders</p>
      <h1 className="text-3xl font-bold tracking-tight">Review your orders</h1>
      <p className="max-w-3xl text-sm text-zinc-600">Find a customer's order and review its purchased items, payment status, and shipping records. Order and payment statuses are verified records and cannot be changed from this page.</p></div>
    <StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/orders" />
    <div className="grid gap-3 sm:grid-cols-3" aria-label="How to manage orders">
      <GuideCard step="1" title="Find an order" text="Filter by status or browse the latest orders." />
      <GuideCard step="2" title="Review its details" text="Open an order to check items, totals and payment records." />
      <GuideCard step="3" title="Plan shipping" text="For eligible physical orders, record a pending shipment plan." />
    </div>
    <section aria-labelledby="orders-list-heading" className="space-y-4">
      <div><h2 id="orders-list-heading" className="text-lg font-semibold">Orders in {store.storeName}</h2><p className="mt-1 text-xs text-zinc-500">Status filters show records from this storefront only.</p></div>
      <nav aria-label="Filter orders by status" className="flex flex-wrap gap-2">{statuses.map(item => <Link key={item.value} href={`${path}&status=${item.value}`} aria-current={item.value === selectedStatus ? "page" : undefined} className={`rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${item.value === selectedStatus ? "bg-zinc-900 text-white" : "border bg-white text-zinc-700 hover:border-zinc-400"}`}>{item.label}</Link>)}</nav>
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4"><p className="text-sm font-semibold">{snapshot.total} {selectedStatus === "ALL" ? "orders" : selectedStatus.toLowerCase() + " orders"}</p><p className="text-xs text-zinc-500">Choose an order to view the details</p></div>
        <table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr>{["Order", "Customer", "Created (UTC)", "Items", "Status", "Total"].map(column => <th scope="col" key={column} className="px-4 py-3 font-medium">{column}</th>)}</tr></thead>
          <tbody className="divide-y">{snapshot.rows.map(order => <tr key={order.id} className="hover:bg-zinc-50"><td className="px-4 py-3 font-semibold"><Link className="underline decoration-zinc-300 underline-offset-4 hover:text-amber-800" href={`/merchant/orders/${encodeURIComponent(order.id)}${storeQuery(store.storeId)}`} aria-label={`Open order ${order.id}`}>{order.id.slice(0, 13)}…</Link></td>
            <td className="px-4 py-3">{order.customer?.name || order.customer?.email || "Guest"}</td><td className="px-4 py-3 text-zinc-500">{dateTime(order.createdAt)}</td><td className="px-4 py-3">{order._count.items}</td><td className="px-4 py-3"><RecordPill status={order.status}/></td><td className="px-4 py-3 font-semibold">{money(order.totalMinor, order.currency)}</td></tr>)}</tbody></table>
        {snapshot.rows.length === 0 && <div className="space-y-2 p-6"><h3 className="font-semibold">No matching orders</h3><p className="text-sm text-zinc-500">Try another status or return to all orders. No sample or test orders are created by this page.</p><Link href={path} className="inline-block text-sm font-semibold underline">View all orders</Link></div>}
      </div>
      <Pager base="/merchant/orders" storeId={store.storeId} page={snapshot.page} pages={snapshot.pages} extra={selectedStatus === "ALL" ? "" : `&status=${selectedStatus}`}/>
    </section>
  </div>;
}

function GuideCard({ step, title, text }: { step: string; title: string; text: string }) {
  return <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-xs font-bold text-amber-800">{step}</span><h2 className="text-sm font-semibold">{title}</h2></div><p className="mt-2 text-xs text-zinc-500">{text}</p></div>;
}
