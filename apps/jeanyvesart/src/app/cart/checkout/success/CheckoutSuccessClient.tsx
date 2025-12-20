// File: src/app/cart/checkout/success/CheckoutSuccessClient.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

type SuccessDTO = {
  id: string;
  status: string;
  total: number;
  placedAt: string;
  site: "JEANYVES";
  shipping: null | {
    label?: string | null;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: Array<{
    id: string;
    type: "ORIGINAL" | "PRINT" | "DIGITAL";
    price: number;
    quantity: number;
    previewUrl: string | null;
    product: { id: string; title: string };
    original: null | {
      id: string;
      status?: string | null;
      medium?: string | null;
      year?: number | null;
      widthIn?: number | null;
      heightIn?: number | null;
      depthIn?: number | null;
      framed?: boolean | null;
      originalSerial?: string | null;
      soldAt?: string | null;
    };
  }>;
  canClaim: boolean;
  processing: boolean;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function fmtIn(n?: number | null) {
  return typeof n === "number" ? `${Number(n.toFixed(2))}″` : "—";
}

export default function CheckoutSuccessClient() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id") || "";
  const claim = sp.get("claim") || "";

  const [data, setData] = React.useState<SuccessDTO | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchOrder = React.useCallback(async () => {
    if (!sessionId) return;
    const qs = new URLSearchParams({ session_id: sessionId });
    if (claim) qs.set("claim", claim);

    const res = await fetch(`/api/orders/by-session?${qs.toString()}`, {
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Failed to load order");
    return json as SuccessDTO;
  }, [sessionId, claim]);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const j = await fetchOrder();
        if (!alive) return;
        setData(j ?? null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error loading order");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fetchOrder]);

  // Auto-refresh while webhook is finalizing (shipping/status)
  React.useEffect(() => {
    if (!data?.processing) return;
    const t = setInterval(async () => {
      try {
        const j = await fetchOrder();
        if (j) setData(j);
      } catch {
        // ignore polling errors
      }
    }, 1500);
    return () => clearInterval(t);
  }, [data?.processing, fetchOrder]);

  if (!sessionId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Missing <b>session_id</b>.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        Thank you for your purchase
      </h1>

      {loading && (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-neutral-100" />
      )}

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      )}

      {data && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-700">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
              Status: <b className="text-neutral-900">{data.status}</b>
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
              Total: <b className="text-neutral-900">{money(data.total)}</b>
            </span>

            {data.processing && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                Processing… (saving shipping + finalizing order)
              </span>
            )}
          </div>

          {/* Items */}
          <div className="mt-6">
            <h2 className="text-sm font-medium tracking-wide text-neutral-700">
              Purchased artwork
            </h2>

            <div className="mt-3 space-y-3">
              {data.items.map((it) => (
                <div
                  key={it.id}
                  className="flex gap-3 rounded-xl border border-neutral-200 p-3"
                >
                  <div className="relative h-24 w-20 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    {it.previewUrl ? (
                      <Image
                        src={it.previewUrl}
                        alt={it.product.title}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {it.product.title}
                        </p>
                        <p className="text-xs text-neutral-500">
                          Original artwork
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {money(it.price)}
                      </p>
                    </div>

                    {it.original && (
                      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-neutral-700 sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="text-neutral-500">Medium</dt>
                          <dd className="truncate">
                            {it.original.medium ?? "—"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-neutral-500">Year</dt>
                          <dd>{it.original.year ?? "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-neutral-500">Size</dt>
                          <dd>
                            {fmtIn(it.original.widthIn)} ×{" "}
                            {fmtIn(it.original.heightIn)} ×{" "}
                            {fmtIn(it.original.depthIn)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-neutral-500">Serial</dt>
                          <dd className="truncate">
                            {it.original.originalSerial ?? "—"}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping */}
          <div className="mt-6 rounded-xl border border-neutral-200 p-4">
            <h2 className="text-sm font-medium tracking-wide text-neutral-700">
              Shipping address
            </h2>

            {!data.shipping ? (
              <p className="mt-2 text-sm text-neutral-600">
                Not saved yet — this usually appears within a few seconds.
              </p>
            ) : (
              <div className="mt-2 text-sm text-neutral-800">
                <p className="font-medium">
                  {data.shipping.label ?? "Shipping"}
                </p>
                <p>{data.shipping.street}</p>
                <p>
                  {data.shipping.city}, {data.shipping.state}{" "}
                  {data.shipping.postalCode}
                </p>
                <p>{data.shipping.country}</p>
              </div>
            )}
          </div>

          {/* Guest claim UX */}
          {data.canClaim && (
            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <h2 className="text-sm font-medium text-neutral-900">
                Save this purchase
              </h2>
              <p className="mt-1 text-sm text-neutral-700">
                You checked out as a guest. Create an account to keep this order
                in your profile.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/auth/register?claim=${encodeURIComponent(
                    claim
                  )}&session_id=${encodeURIComponent(sessionId)}`}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Create account
                </a>
                <a
                  href={`/auth/login?claim=${encodeURIComponent(
                    claim
                  )}&session_id=${encodeURIComponent(sessionId)}`}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  I already have an account
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
