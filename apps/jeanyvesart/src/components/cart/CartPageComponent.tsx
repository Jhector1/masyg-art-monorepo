// apps/<site>/src/app/cart/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

// Reuse your shared pricing helpers
import { applyBundleIfBoth, getEffectiveSale, roundMoney } from "@acme/core/lib/pricing";

// ---------- Types (aligned with your API) ----------
type VariantType = "DIGITAL" | "PRINT" | "ORIGINAL" | null;

type CartProduct = {
  id: string;
  title: string;
  price: number;
  thumbnails: string[];
  salePrice?: number | null;
  salePercent?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  sizes?: string[];
  designs?: { previewUrl?: string | null }[];
};

type CartItem = {
  id: string;                 // cart item id
  productId: string;
  product: CartProduct;
  variantType: VariantType;   // "DIGITAL" | "PRINT" | "ORIGINAL" | null
  variantId?: string | null;  // if your schema has it
  size?: string | null;       // for PRINT / DIGITAL selected size
  material?: string | null;   // paper/canvas for PRINT
  frame?: string | null;      // "BLACK","NATURAL", etc.
  license?: string | null;    // for DIGITAL
  unitPrice?: number | null;  // server-computed unit price (preferred)
  quantity: number;
};

type CartResponse = {
  items: CartItem[];
};

// ---------- Minimal helpers ----------
function effectiveUnitPrice(p: CartProduct, fallback?: number | null) {
  // Prefer server-computed unitPrice when provided elsewhere (per item)
  const sale = getEffectiveSale({
    price: p.price,
    salePrice: p.salePrice ?? undefined,
    salePercent: p.salePercent ?? undefined,
    saleStartsAt: p.saleStartsAt ?? undefined,
    saleEndsAt: p.saleEndsAt ?? undefined
  });
  return roundMoney(fallback ?? sale.price);
}

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

// ---------- Cart Page ----------
export default function CartPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch cart
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/cart", { cache: "no-store" });
        if (!res.ok) throw new Error(`Fetch cart failed: ${res.status}`);
        const data: CartResponse = await res.json();
        if (!alive) return;
        setItems(data.items ?? []);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load cart");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Compute pricing with your bundle rule when both DIGITAL & PRINT of same product are present
  const { subtotal, discount, total } = useMemo(() => {
    // Basic line totals
    const lines = items.map((it) => {
      const p = it.product;
      const price = effectiveUnitPrice(p, it.unitPrice);
      return { key: it.id, productId: it.productId, type: it.variantType, qty: it.quantity, line: price * it.quantity, unit: price };
    });

    // Group by product for bundle logic
    const byProduct = new Map<string, Array<typeof lines[number]>>();
    for (const ln of lines) {
      const arr = byProduct.get(ln.productId) ?? [];
      arr.push(ln);
      byProduct.set(ln.productId, arr);
    }

    let rawSubtotal = 0;
    let rawDiscount = 0;

    for (const arr of byProduct.values()) {
      const hasDigital = arr.some(a => a.type === "DIGITAL");
      const hasPrint   = arr.some(a => a.type === "PRINT");
      const groupSum   = arr.reduce((s, x) => s + x.line, 0);
      if (hasDigital && hasPrint) {
        const bundle = applyBundleIfBoth({
          printTotal: arr.filter(a => a.type === "PRINT").reduce((s, x) => s + x.line, 0),
          digitalTotal: arr.filter(a => a.type === "DIGITAL").reduce((s, x) => s + x.line, 0),
        });
        rawSubtotal += bundle.total;
        rawDiscount += roundMoney(groupSum - bundle.total);
      } else {
        rawSubtotal += groupSum;
      }
    }

    const finalTotal = roundMoney(rawSubtotal);
    return {
      subtotal: roundMoney(rawSubtotal + rawDiscount), // before bundle discount
      discount: roundMoney(rawDiscount),
      total: finalTotal,
    };
  }, [items]);

  async function updateQty(itemId: string, nextQty: number) {
    if (nextQty < 1) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity: nextQty }),
      });
      if (!res.ok) throw new Error("Update failed");
      const data: CartResponse = await res.json();
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to update quantity");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error("Remove failed");
      const data: CartResponse = await res.json();
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to remove item");
    } finally {
      setSaving(false);
    }
  }

  // ---------- UI ----------
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-8 md:py-12">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Cart</h1>
          <p className="mt-2 text-sm text-neutral-500">A calm, minimal space for your selection.</p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-neutral-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-neutral-500">Your cart is empty.</p>
            <Link href="/shop" className="inline-block mt-6 rounded-2xl border px-5 py-2 text-sm hover:shadow-sm">
              Continue shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((it) => {
                const p = it.product;
                const thumb = (p.designs?.[0]?.previewUrl || p.thumbnails?.[0]) ?? "";
                const unit = effectiveUnitPrice(p, it.unitPrice);
                const line = roundMoney(unit * it.quantity);

                return (
                  <motion.article
                    key={it.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border p-3 md:p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex gap-3 md:gap-4">
                      <div className="relative h-24 w-24 md:h-28 md:w-28 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt={p.title}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base md:text-lg font-medium">{p.title}</h3>
                            <div className="mt-1 text-xs md:text-sm text-neutral-500 space-x-2">
                              {it.variantType && <span>{it.variantType}</span>}
                              {it.size && <span>• {it.size}</span>}
                              {it.material && <span>• {it.material}</span>}
                              {it.frame && <span>• Frame: {it.frame}</span>}
                              {it.license && <span>• {it.license}</span>}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm text-neutral-500">Unit</div>
                            <div className="text-base md:text-lg tabular-nums">${unit.toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-xl border">
                            <button
                              aria-label="Decrease quantity"
                              onClick={() => updateQty(it.id, it.quantity - 1)}
                              className="px-3 py-2 text-sm disabled:opacity-40"
                              disabled={saving || it.quantity <= 1}
                            >
                              –
                            </button>
                            <span className="px-3 py-2 text-sm tabular-nums">{it.quantity}</span>
                            <button
                              aria-label="Increase quantity"
                              onClick={() => updateQty(it.id, it.quantity + 1)}
                              className="px-3 py-2 text-sm disabled:opacity-40"
                              disabled={saving}
                            >
                              +
                            </button>
                          </div>

                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => removeItem(it.id)}
                              className={classNames(
                                "text-sm underline-offset-4 hover:underline disabled:opacity-40",
                                saving && "pointer-events-none"
                              )}
                              disabled={saving}
                            >
                              Remove
                            </button>
                            <div className="text-right">
                              <div className="text-sm text-neutral-500">Line</div>
                              <div className="text-base md:text-lg tabular-nums">${line.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>

            {/* Summary */}
            <aside className="lg:sticky lg:top-8 h-max rounded-2xl border p-4 md:p-6">
              <h2 className="text-lg font-medium">Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Subtotal</dt>
                  <dd className="tabular-nums">${subtotal.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Bundle savings</dt>
                  <dd className="tabular-nums text-emerald-600">–${discount.toFixed(2)}</dd>
                </div>
                <div className="my-3 h-px bg-neutral-200" />
                <div className="flex justify-between text-base">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-medium tabular-nums">${total.toFixed(2)}</dd>
                </div>
              </dl>

              <button
                className={classNames(
                  "mt-6 w-full rounded-2xl px-5 py-3 text-sm font-medium",
                  "bg-black text-white hover:opacity-90 transition-opacity",
                  saving && "opacity-60"
                )}
                onClick={() => {
                  // You likely already have a checkout flow; adjust this navigation if needed.
                  window.location.href = "/checkout";
                }}
                disabled={saving || items.length === 0}
              >
                Checkout
              </button>

              <p className="mt-3 text-xs text-neutral-500">
                Taxes & shipping calculated at checkout (if applicable).
              </p>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
