"use client";

import type { BuyerOrder } from "@acme/core/lib/client/storefront-commerce";
import { buyerOrderDate, buyerOrderMoney, buyerOrderStatus } from "@acme/core/lib/buyer-order-history";

type Props = {
  orders: BuyerOrder[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onViewCollections: () => void;
};

const tones = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  progress: "bg-blue-50 text-blue-700 ring-blue-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  neutral: "bg-gray-100 text-gray-700 ring-gray-200",
} as const;

export default function OrderHistory({ orders, loading, error, onRefresh, onViewCollections }: Props) {
  return (
    <section aria-labelledby="orders-heading" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id="orders-heading" className="text-2xl font-bold text-gray-900">Order history</h2>
          <p className="text-sm text-gray-600">Review recent purchases, payment statuses and order details.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {loading ? "Checking…" : "Refresh orders"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          We couldn't load your orders. Please try refreshing.
        </p>
      )}
      {loading && orders.length === 0 && !error && <p role="status" className="text-sm text-gray-600">Loading order history…</p>}
      {!loading && !error && orders.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="font-semibold text-gray-900">No orders yet</p>
          <p className="mt-1 text-sm text-gray-600">Your purchases will appear here after checkout.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = buyerOrderStatus(order.status);
            const digitalPurchased = order.items.some((item) => item.fulfillment === "DIGITAL");
            const canBrowseDigital = digitalPurchased && ["PAID", "FULFILLING", "FULFILLED"].includes(order.status);
            return (
              <details key={order.id} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm open:shadow-md">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-gray-900">Order {order.id.slice(0, 12)}…</p>
                    <p className="text-sm text-gray-500">{buyerOrderDate(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${tones[status.tone]}`}>{status.label}</span>
                    <span className="font-semibold text-gray-900">{buyerOrderMoney(order.totalMinor, order.currency)}</span>
                    <span aria-hidden="true" className="text-gray-500 transition group-open:rotate-180">⌄</span>
                  </div>
                </summary>
                <div className="space-y-4 border-t border-gray-100 px-5 py-4">
                  <p className="break-all text-xs text-gray-500">Order ID: {order.id}</p>
                  <ul className="divide-y divide-gray-100" aria-label="Purchased items">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{item.titleSnapshot}</p>
                          <p className="text-gray-500">{item.fulfillment === "DIGITAL" ? "Digital" : "Physical"} · Qty {item.quantity}</p>
                        </div>
                        <span className="font-medium text-gray-700">{buyerOrderMoney(item.totalMinor, order.currency)}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="ml-auto max-w-xs space-y-2 text-sm">
                    <div className="flex justify-between gap-6"><dt className="text-gray-500">Subtotal</dt><dd>{buyerOrderMoney(order.subtotalMinor, order.currency)}</dd></div>
                    <div className="flex justify-between gap-6"><dt className="text-gray-500">Shipping</dt><dd>{buyerOrderMoney(order.shippingMinor, order.currency)}</dd></div>
                    <div className="flex justify-between gap-6"><dt className="text-gray-500">Tax</dt><dd>{buyerOrderMoney(order.taxMinor, order.currency)}</dd></div>
                    <div className="flex justify-between gap-6 border-t pt-2 font-semibold"><dt>Original total</dt><dd>{buyerOrderMoney(order.totalMinor, order.currency)}</dd></div>
                  </dl>
                  {order.status === "REFUNDED" && digitalPurchased && (
                    <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Digital download access ended when this order was fully refunded.</p>
                  )}
                  {canBrowseDigital && (
                    <button type="button" onClick={onViewCollections}
                      className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      View purchased art
                    </button>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-500">Showing up to 50 recent orders for this storefront. Refund amounts and tracking are not included in this summary.</p>
    </section>
  );
}
