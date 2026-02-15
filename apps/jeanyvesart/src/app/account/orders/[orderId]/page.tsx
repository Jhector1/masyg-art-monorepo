// File: src/app/account/orders/[orderId]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";

type OrderDetail = {
  id: string;
  site: "JEANYVES" | "ZILEDIGITAL";
  status: string;
  total: number;
  placedAt: string;
  updatedAt: string;
  userId: string | null;
  guestId: string | null;
  shipping: {
    id: string;
    label: string | null;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    createdAt: string;
  } | null;
  payment: {
    status: string;
    amount: number;
    provider: string;
    transactionId: string;
    createdAt: string;
  } | null;
  items: Array<{
    id: string;
    type: "DIGITAL" | "PRINT" | "ORIGINAL";
    quantity: number;
    price: number;
    previewUrlSnapshot: string | null;
    product: { id: string; title: string; thumbnails: string[]; description: string };
    originalVariant: {
      id: string;
      status: "ACTIVE" | "RESERVED" | "SOLD";
      originalSerial: string | null;
      medium: string | null;
      year: number | null;
      widthIn: number | null;
      heightIn: number | null;
      depthIn: number | null;
      framed: boolean | null;
      weightLb: number | null;
      soldAt: string | null;
    } | null;
  }>;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleString();
}
function fmtInch(n?: number | null) {
  return typeof n === "number" ? `${Number(n.toFixed(2))}″` : "—";
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase?.() ?? "PENDING";
  const cls =
    s === "PAID"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "CANCELED"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${cls}`}>
      {s}
    </span>
  );
}

export default function OrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const params = React.use(props.params); // ✅ unwrap Promise params
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const SITE: "JEANYVES" | "ZILEDIGITAL" = "JEANYVES";

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/user/orders/${params.orderId}?site=${SITE}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to load order");
        if (!alive) return;
        setOrder(json?.order ?? null);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.orderId]);

  return (
    <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Back to orders
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Order details</h1>
        </div>

        <Link
          href="/"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Shop
        </Link>
      </div>

      {loading && <div className="mt-6 h-56 animate-pulse rounded-2xl bg-neutral-100" />}

      {err && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      )}

      {!loading && !err && order && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {/* Left: Summary */}
          <div className="md:col-span-1 rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-900">#{order.id.slice(0, 8)}</span>
              <StatusBadge status={order.status} />
            </div>

            <div className="mt-3 space-y-2 text-sm text-neutral-700">
              <div className="flex justify-between">
                <span className="text-neutral-500">Placed</span>
                <span>{fmtDateTime(order.placedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Updated</span>
                <span>{fmtDateTime(order.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Total</span>
                <span className="font-semibold text-neutral-900">{money(order.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Site</span>
                <span>{order.site}</span>
              </div>
            </div>

            <div className="mt-4 border-t border-neutral-200 pt-4">
              <h2 className="text-sm font-medium text-neutral-900">Payment</h2>
              <div className="mt-2 text-sm text-neutral-700">
                {order.payment ? (
                  <div className="space-y-1">
                    <div>
                      <span className="text-neutral-500">Status: </span>
                      {order.payment.status}
                    </div>
                    <div>
                      <span className="text-neutral-500">Provider: </span>
                      {order.payment.provider}
                    </div>
                    <div className="break-all">
                      <span className="text-neutral-500">Txn: </span>
                      {order.payment.transactionId}
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-500">—</div>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-neutral-200 pt-4">
              <h2 className="text-sm font-medium text-neutral-900">Shipping</h2>
              <div className="mt-2 text-sm text-neutral-700">
                {order.shipping ? (
                  <div className="space-y-1">
                    <div>{order.shipping.street}</div>
                    <div>
                      {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}
                    </div>
                    <div>{order.shipping.country}</div>
                  </div>
                ) : (
                  <div className="text-neutral-500">—</div>
                )}
              </div>
            </div>

            {/* Optional guest hint */}
            {order.guestId && !order.userId && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                This order is tied to a guest session on this device. Create an account to keep it accessible everywhere.
              </div>
            )}
          </div>

          {/* Right: Items */}
          <div className="md:col-span-2 rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-medium tracking-wide text-neutral-900">Items</h2>

            <div className="mt-3 space-y-3">
              {order.items.map((it) => {
                const img =
                  it.previewUrlSnapshot ||
                  it.product.thumbnails?.[0] ||
                  null;

                const ov = it.originalVariant;

                return (
                  <div key={it.id} className="flex gap-3 rounded-xl border border-neutral-200 p-3">
                    <div className="h-20 w-20 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-neutral-900">{it.product.title}</div>
                        <div className="text-sm font-semibold text-neutral-900">{money(it.price)}</div>
                      </div>

                      <div className="mt-1 text-xs text-neutral-500">
                        Type: {it.type} • Qty: {it.quantity}
                      </div>

                      {ov && (
                        <div className="mt-2 text-xs text-neutral-600">
                          <div>
                            <span className="text-neutral-500">Status:</span> {ov.status}
                            {ov.originalSerial ? <> • <span className="text-neutral-500">Serial:</span> {ov.originalSerial}</> : null}
                          </div>
                          <div>
                            <span className="text-neutral-500">Medium:</span> {ov.medium ?? "—"} •{" "}
                            <span className="text-neutral-500">Year:</span> {ov.year ?? "—"}
                          </div>
                          <div>
                            <span className="text-neutral-500">Dims:</span> {fmtInch(ov.widthIn)} × {fmtInch(ov.heightIn)} ×{" "}
                            {fmtInch(ov.depthIn)} • <span className="text-neutral-500">Framed:</span>{" "}
                            {ov.framed ? "Yes" : "No"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
