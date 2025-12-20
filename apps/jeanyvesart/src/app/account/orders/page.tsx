// File: src/app/account/orders/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";

type OrderListItem = {
  id: string;
  status: string;
  total: number;
  placedAt: string;
  site: "JEANYVES" | "ZILEDIGITAL";
  stripeSessionId: string | null;
  userId: string | null;
  guestId: string | null;
  payment: { status: string; provider: string; transactionId: string } | null;
  shipping: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  items: Array<{
    id: string;
    type: "DIGITAL" | "PRINT" | "ORIGINAL";
    quantity: number;
    price: number;
    previewUrlSnapshot: string | null;
    product: { id: string; title: string; thumbnails: string[] };
  }>;
  _count: { items: number };
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
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

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<OrderListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // If this app is jeanyvesart, default to JEANYVES
  const SITE: "JEANYVES" | "ZILEDIGITAL" = "JEANYVES";

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/orders?site=${SITE}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to load orders");
        if (!alive) return;
        setOrders(json?.orders ?? []);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">My Orders</h1>
          <p className="mt-1 text-sm text-neutral-600">
            View your purchases, shipping details, and payment status.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Continue shopping
        </Link>
      </div>

      {loading && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-neutral-100" />}

      {err && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      )}

      {!loading && !err && orders.length === 0 && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-700">No orders yet.</p>
        </div>
      )}

      {!loading && !err && orders.length > 0 && (
        <div className="mt-6 space-y-4">
          {orders.map((o) => {
            const firstImg =
              o.items?.[0]?.previewUrlSnapshot ||
              o.items?.[0]?.product?.thumbnails?.[0] ||
              null;

            const ship = o.shipping
              ? `${o.shipping.city}, ${o.shipping.state} ${o.shipping.postalCode}`
              : "—";

            return (
              <Link
                key={o.id}
                href={`/account/orders/${o.id}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-4 transition hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                      {firstImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={firstImg} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">Order #{o.id.slice(0, 8)}</span>
                        <StatusBadge status={o.status} />
                        {o.payment?.status ? (
                          <span className="text-xs text-neutral-500">• Payment: {o.payment.status}</span>
                        ) : (
                          <span className="text-xs text-neutral-500">• Payment: —</span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-neutral-600">
                        Placed {fmtDate(o.placedAt)} • {o._count.items} item{o._count.items !== 1 ? "s" : ""} • Ship:{" "}
                        {ship}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-neutral-900">{money(o.total)}</div>
                      <div className="text-xs text-neutral-500">{o.site}</div>
                    </div>
                    <span className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                      View
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
