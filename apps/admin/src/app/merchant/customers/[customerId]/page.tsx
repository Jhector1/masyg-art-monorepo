import Link from "next/link";
import { notFound } from "next/navigation";
import { TenantAccessError } from "@acme/core/lib/tenancy";
import { merchantWorkspace } from "@/lib/merchant-workspace";
import { getMerchantCustomer } from "@acme/core/lib/merchant-orders-customers";
import { listMerchantCustomerNotes } from "@acme/core/lib/merchant-customer-notes";
import CustomerNotes from "@/components/merchant/CustomerNotes";
import { dateTime, money, RecordPill } from "@/components/merchant/CommerceRecords";
import { storeQuery } from "@/lib/merchant-navigation";
export const dynamic = "force-dynamic";
export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ customerId: string }>; searchParams: Promise<{ store?: string }> }) {
  const { userId, store } = await merchantWorkspace(searchParams);
  if (!store || store.role === "MEMBER") notFound();
  const customer = await getMerchantCustomer({ userId, organizationId: store.organizationId, storeId: store.storeId, customerId: (await params).customerId }).catch((error: unknown) => { if (error instanceof TenantAccessError) notFound(); throw error; });
  const notes = await listMerchantCustomerNotes({ userId, organizationId: store.organizationId, storeId: store.storeId, customerId: customer.id });
  return <div className="space-y-6"><Link className="text-sm font-semibold text-zinc-600 underline" href={`/merchant/customers${storeQuery(store.storeId)}`}>← Customers</Link><div><h1 className="text-2xl font-bold">{customer.name || customer.email}</h1><p className="mt-2 text-sm text-zinc-600">{customer.email} · Customer since {dateTime(customer.createdAt)}</p></div>
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Orders in {store.storeName}</h2><p className="mt-1 text-xs text-zinc-500">Most recent 30 orders, read-only.</p><div className="mt-4 divide-y">{customer.orders.length ? customer.orders.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><Link className="underline decoration-zinc-300" href={`/merchant/orders/${o.id}${storeQuery(store.storeId)}`}>{o.id.slice(0,16)}… · {dateTime(o.createdAt)}</Link><RecordPill status={o.status}/><strong>{money(o.totalMinor,o.currency)}</strong></div>) : <p>No orders</p>}</div></section>
    <CustomerNotes organizationId={store.organizationId} storeId={store.storeId} customerId={customer.id} rows={notes}/></div>;
}
