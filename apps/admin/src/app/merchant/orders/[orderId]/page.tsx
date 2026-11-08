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
  const order = await getMerchantOrder({ userId, organizationId: store.organizationId, storeId: store.storeId, orderId: (await params).orderId })
    .catch((error: unknown) => { if (error instanceof TenantAccessError) notFound(); throw error; });
  const physicalItems = order.items.filter(item => item.fulfillment === "PHYSICAL");
  const digitalItems = order.items.filter(item => item.fulfillment === "DIGITAL");
  const physicalUnits = physicalItems.reduce((total, item) => total + item.quantity, 0);
  const digitalUnits = digitalItems.reduce((total, item) => total + item.quantity, 0);
  const addressLines = readableShippingAddress(order.shippingAddress);

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="space-y-3"><Link className="text-sm font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-4" href={`/merchant/orders${storeQuery(store.storeId)}`}>← All orders in {store.storeName}</Link>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Store workspace / Orders / Details</p>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">Order ···{order.id.slice(-8)}</h1><RecordPill status={order.status}/></div>
      <p className="text-xs text-zinc-500">Short reference from the order ID (not a separate order number). Created {dateTime(order.createdAt)} · Updated {dateTime(order.updatedAt)}.</p>
      <details className="text-xs text-zinc-600"><summary className="cursor-pointer font-medium underline underline-offset-2">View full order identifier</summary><code className="mt-2 block break-all rounded-lg bg-zinc-100 p-3">{order.id}</code></details>
    </div>
    <section aria-label="Order fulfillment overview" className="grid gap-3 sm:grid-cols-3">
      <OverviewMetric title="Digital purchases" value={`${digitalUnits} unit(s)`} detail={digitalItems.length ? `${digitalItems.length} digital item line(s). Download entitlement is not verified here.` : "No digital items in this order."}/>
      <OverviewMetric title="Physical purchases" value={`${physicalUnits} unit(s)`} detail={physicalItems.length ? `${physicalItems.length} physical item line(s) need shipment review.` : "No physical shipping needed."}/>
      <OverviewMetric title="Shipment records" value={String(order.shipments.length)} detail="Read recorded shipment statuses below; a pending plan does not mean shipped."/>
    </section>
    <nav aria-label="Order details sections" className="grid gap-3 sm:grid-cols-3">
      <JumpCard href="#order-items" number="1" title="Purchased items" detail="Review products and totals" />
      <JumpCard href="#order-payments" number="2" title="Payment records" detail="Check verified payment status" />
      <JumpCard href="#order-shipping" number="3" title="Shipping" detail="See shipments and plan physical delivery" />
    </nav>
    <div className="grid gap-5 lg:grid-cols-3">
      <section id="order-items" aria-labelledby="purchased-items-heading" className="scroll-mt-8 rounded-2xl border bg-white p-5 lg:col-span-2">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 1</p><h2 id="purchased-items-heading" className="mt-1 text-lg font-semibold">What did the customer buy?</h2>
        <div className="mt-4 divide-y">{order.items.map(item => <div key={item.id} className="flex justify-between gap-4 py-3 text-sm"><div><p className="font-semibold">{item.titleSnapshot}</p><p className="text-zinc-500">{item.fulfillment === "DIGITAL" ? "Digital download" : item.fulfillment === "PHYSICAL" ? "Physical delivery" : item.fulfillment} · {item.skuSnapshot || "No SKU"} · Qty {item.quantity}</p></div><span className="shrink-0 font-medium">{money(item.totalMinor, order.currency)}</span></div>)}</div>
        <div className="mt-4 space-y-2 border-t pt-3 text-sm">{[["Subtotal", order.subtotalMinor], ["Tax", order.taxMinor], ["Shipping", order.shippingMinor], ["Total", order.totalMinor]].map(([label, amount]) => <div key={String(label)} className="flex justify-between"><span>{label}</span><strong>{money(Number(amount), order.currency)}</strong></div>)}</div>
      </section>
      <aside className="space-y-4"><section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Customer</h2>{order.customer ? <><p className="mt-2 text-sm">{order.customer.name || "—"}</p><p className="text-sm text-zinc-500">{order.customer.email}</p><Link className="mt-3 inline-block text-sm font-semibold underline" href={`/merchant/customers/${order.customer.id}${storeQuery(store.storeId)}`}>View customer</Link></> : <p className="mt-2 text-sm text-zinc-500">Guest / no customer record</p>}</section>
        <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Shipping address (recorded at checkout)</h2><address className="mt-3 space-y-1 not-italic text-sm text-zinc-700">{addressLines.length ? addressLines.map((line, i) => <p key={i} className="break-words">{line}</p>) : <p className="text-zinc-500">No shipping address recorded</p>}</address></section></aside>
    </div>
    <section id="order-payments" aria-labelledby="order-payments-heading" className="scroll-mt-8 rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 2</p><h2 id="order-payments-heading" className="mt-1 text-lg font-semibold">Payment records</h2>
      <p className="mt-1 text-sm text-zinc-500">These payment records are read-only. This screen cannot capture payments, change payment status, or issue refunds.</p>
      <div className="mt-3 divide-y">{order.payments.length ? order.payments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div>{payment.provider} · {dateTime(payment.createdAt)}</div><div className="flex items-center gap-3"><RecordPill status={payment.status}/><strong>{money(payment.amountMinor, payment.currency)}</strong></div></div>) : <p className="py-4 text-sm text-zinc-500">No payment record yet</p>}</div>
    </section>
    <section id="order-shipping" aria-labelledby="order-shipping-heading" className="scroll-mt-8 space-y-4">
      <div className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Step 3</p><h2 id="order-shipping-heading" className="mt-1 text-lg font-semibold">Physical shipping</h2>
        <p className="mt-1 text-sm text-zinc-500">{physicalItems.length ? `${physicalItems.length} physical item line(s). Review shipment records below or make a pending shipment plan.` : "This order has no physical item lines. Shipping plans are not applicable."}</p>
        <div className="mt-3 divide-y">{order.shipments.length ? order.shipments.map(shipment => <div key={shipment.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{shipment.carrier || "Carrier not set"} · {shipment.trackingNumber || "No tracking"} · {dateTime(shipment.createdAt)}</span><RecordPill status={shipment.status}/></div>) : <p className="py-3 text-sm text-zinc-500">No shipments recorded</p>}</div>
      </div>
      {physicalItems.length > 0 && <ShipmentPlanner organizationId={store.organizationId} storeId={store.storeId} orderId={order.id} status={order.status} items={order.items} />}
    </section>
  </div>;
}

function OverviewMetric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-zinc-500">{title}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-zinc-600">{detail}</p></div>;
}

function JumpCard({ href, number, title, detail }: { href: string; number: string; title: string; detail: string }) {
  return <Link href={href} className="group rounded-2xl border bg-white p-4 transition hover:border-zinc-400 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-sm font-bold text-amber-800">{number}</span><span className="font-semibold">{title}</span></div><p className="mt-2 text-xs text-zinc-500">{detail}</p><p className="mt-2 text-xs font-semibold text-amber-800 group-hover:underline">Go to section →</p></Link>;
}

/** Display available checkout address fields without exposing raw JSON to merchants. */
function readableShippingAddress(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const value = raw as Record<string, unknown>;
  const address = (value.address && typeof value.address === "object" && !Array.isArray(value.address))
    ? { ...value, ...(value.address as Record<string, unknown>) } : value;
  function get(...keys: string[]): string {
    const found = keys.map(key => address[key]).find(item => typeof item === "string" && item.trim());
    return typeof found === "string" ? found.trim() : "";
  }
  const name = get("name", "fullName", "full_name", "recipient", "recipientName");
  const lines = [get("line1", "address1", "addressLine1", "street", "street1"), get("line2", "address2", "addressLine2", "street2")].filter(Boolean);
  const city = get("city", "town");
  const region = get("state", "province", "region", "stateCode");
  const postalCode = get("postalCode", "postal_code", "zip", "zipCode");
  const country = get("country", "countryCode", "country_code");
  const locality = [city, region, postalCode].filter(Boolean).join(", ");
  const result = [name, ...lines, locality, country].filter(Boolean);
  if (result.length) return result;
  // Unknown address format: show readable scalar fields instead of a JSON blob.
  return Object.entries(address)
    .filter(([, item]) => typeof item === "string" && item.trim())
    .map(([key, item]) => `${key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")}: ${String(item)}`);
}
