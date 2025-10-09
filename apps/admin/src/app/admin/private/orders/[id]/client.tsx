"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OrderDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/admin/orders/${id}`, { cache: "no-store" });
      if (!alive) return;
      if (r.ok) {
        const j = await r.json();
        setData(j);
        setStatus(j.status ?? "");
      } else {
        setData({ error: "Failed to load" });
      }
    })();
    return () => { alive = false; };
  }, [id]);

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",                                     // ⬅ matches route handler below
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        alert("Failed to update");
        return;
      }
      const j = await r.json();
      setData((d: any) => ({ ...(d ?? {}), status: j.status ?? status }));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <main className="p-6">Loading…</main>;

  if (data?.error) {
    return <main className="p-6">Error: {data.error}</main>;
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order {data.id}</h1>
        <Link className="rounded-xl border px-3 py-2 text-sm" href="/admin/private/orders">
          Back to orders
        </Link>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border p-5 space-y-4">
          <div className="text-sm text-muted-foreground">Line Items</div>
          <div className="rounded-xl border overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-sm">Product</th>
                  <th className="px-3 py-2 text-left text-sm">Variant</th>
                  <th className="px-3 py-2 text-left text-sm">Qty</th>
                  <th className="px-3 py-2 text-left text-sm">Price</th>
                </tr>
              </thead>
              <tbody>
                {(data.items ?? []).map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 text-sm">{it.product?.title ?? "—"}</td>
                    <td className="px-3 py-2 text-sm">
                      {it.type}
                      {it.digitalVariant?.format ? ` • ${it.digitalVariant.format}` : ""}
                      {it.printVariant?.size ? ` • ${it.printVariant.size}` : ""}
                      {it.originalVariant?.sku ? ` • SKU ${it.originalVariant.sku}` : ""}
                    </td>
                    <td className="px-3 py-2 text-sm">{it.quantity}</td>
                    <td className="px-3 py-2 text-sm">${Number(it.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border p-5 space-y-4">
          <div className="text-sm text-muted-foreground">Summary</div>
          <div className="text-3xl font-bold">${Number(data.total).toFixed(2)}</div>
          <div className="text-sm text-muted-foreground">
            Placed {new Date(data.placedAt).toLocaleString()}
          </div>

          <div className="pt-2">
            <div className="text-sm mb-1">Status</div>
            <input
              className="rounded-xl border px-3 py-2 text-sm w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
            <button
              className="mt-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted"
              disabled={busy}
              onClick={save}
            >
              {busy ? "Saving..." : "Save status"}
            </button>
          </div>

          <div className="pt-4 text-sm">
            <div className="font-medium mb-1">Buyer</div>
            <div>{data.user?.email ?? "Guest"}</div>
          </div>

          {data.shipping && (
            <div className="pt-4 text-sm">
              <div className="font-medium mb-1">Shipping</div>
              <div>{data.shipping.label ?? ""}</div>
              <div>{data.shipping.street}</div>
              <div>{data.shipping.city}, {data.shipping.state} {data.shipping.postalCode}</div>
              <div>{data.shipping.country}</div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
