import Link from "next/link";
import { notFound } from "next/navigation";
import { TenantAccessError } from "@acme/core/lib/tenancy";
import { merchantWorkspace } from "@/lib/merchant-workspace";
import { getMerchantOrder } from "@acme/core/lib/merchant-orders-customers";
import { RecordPill, money, dateTime } from "@/components/merchant/CommerceRecords";
import { storeQuery } from "@/lib/merchant-navigation";
import ShipmentPlanner from "@/components/merchant/ShipmentPlanner";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ orderId: string }>; searchParams: Promise<{ store?: string }> };
export default async function OrderDetail({ params, searchParams }: Props) {
  const { userId, store } = await merchantWorkspace(searchParams);
  if (!store || store.role === "MEMBER") notFound();
  const order = await getMerchantOrder({ userId, organizationId: store.organizationId, storeId: store.storeId, orderId: (await params).orderId }).catch((error: unknown) => { if (error instanceof TenantAccessError) notFound(); throw error; });
  return <div className="space-y-6"><Link className="text-sm font-semibold text-zinc-600 underline" href={`/merchant/orders${storeQuery(store.storeId)}`}>← Orders</Link>
    <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">Order {order.id}</h1><RecordPill status={order.status}/></div>
    <p className="text-sm text-zinc-500">Created {dateTime(order.createdAt)} · Updated {dateTime(order.updatedAt)} · Authoritative payment/order statuses · Pending shipment planning only</p>
    <div className="grid gap-5 lg:grid-cols-3"><section className="rounded-2xl border bg-white p-5 lg:col-span-2"><h2 className="text-lg font-semibold">Purchased items</h2><div className="mt-4 divide-y">{order.items.map(i => <div key={i.id} className="flex justify-between gap-4 py-3 text-sm"><div><p className="font-semibold">{i.titleSnapshot}</p><p className="text-zinc-500">{i.fulfillment} · {i.skuSnapshot || "No SKU"} · Qty {i.quantity}</p></div><span>{money(i.totalMinor,order.currency)}</span></div>)}</div><div className="mt-4 space-y-2 border-t pt-3 text-sm">{[["Subtotal",order.subtotalMinor],["Tax",order.taxMinor],["Shipping",order.shippingMinor],["Total",order.totalMinor]].map(([label,amount]) => <div key={String(label)} className="flex justify-between"><span>{label}</span><strong>{money(Number(amount),order.currency)}</strong></div>)}</div></section>
    <aside className="space-y-4"><section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Customer</h2>{order.customer ? <><p className="mt-2 text-sm">{order.customer.name || "—"}</p><p className="text-sm text-zinc-500">{order.customer.email}</p><Link className="mt-3 inline-block text-sm underline" href={`/merchant/customers/${order.customer.id}${storeQuery(store.storeId)}`}>View customer</Link></> : <p className="mt-2 text-sm text-zinc-500">Guest / no customer record</p>}</section><section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Shipping address snapshot</h2><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-500">{order.shippingAddress ? JSON.stringify(order.shippingAddress,null,2) : "No shipping address recorded"}</pre></section></aside></div>
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Payments</h2><div className="mt-3 divide-y">{order.payments.length ? order.payments.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div>{p.provider} · {dateTime(p.createdAt)}</div><div className="flex items-center gap-3"><RecordPill status={p.status}/><strong>{money(p.amountMinor,p.currency)}</strong></div></div>) : <p className="text-sm text-zinc-500">No payment record yet</p>}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Shipments</h2><div className="mt-3 divide-y">{order.shipments.length ? order.shipments.map(s => <div key={s.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{s.carrier || "Carrier not set"} · {s.trackingNumber || "No tracking"} · {dateTime(s.createdAt)}</span><RecordPill status={s.status}/></div>) : <p className="text-sm text-zinc-500">No shipment recorded</p>}</div></section>
    <ShipmentPlanner organizationId={store.organizationId} storeId={store.storeId} orderId={order.id} status={order.status} items={order.items}/></div>;
}
