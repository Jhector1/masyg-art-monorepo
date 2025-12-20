"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type VariantType = "DIGITAL" | "PRINT" | "ORIGINAL";

type CartItem = {
  id?: string;

  productId?: string;
  productVariantId?: string;
  originalVariantId?: string;

  title: string;
  imageUrl?: string | null;

  variantType?: VariantType | string | null;
  quantity: number;

  unitPrice: number;
  lineTotal: number;

  // optional extra info
  options?: Record<string, any> | null;
};

type CartView = {
  items: CartItem[];
  subtotal: number;
  total?: number;
};

function money(n: number) {
  return (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// Very defensive normalizer so it works with different cart API shapes
function normalizeCart(json: any): CartView {
  const rawItems: any[] =
    json?.items ??
    json?.cartItems ??
    json?.selectedItems ??
    json?.cart?.items ??
    json?.cart?.cartItems ??
    (Array.isArray(json) ? json : []);

  const items: CartItem[] = rawItems.map((it: any) => {
    const product = it?.product ?? it?.Product ?? null;

    const title =
      it?.title ??
      it?.name ??
      product?.title ??
      product?.name ??
      "Untitled item";

    const imageUrl =
    it.previewUrl??
      it?.imageUrl ??
      it?.image ??
      product?.imageUrl ??
      product?.thumbnailUrl ??
      product?.thumbnail ??
      null;

    const quantity = Number(it?.quantity ?? it?.qty ?? 1) || 1;

    const unitPrice =
      Number(
        it?.unitPrice ??
          it?.finalUnitPrice ??
          it?.price ??
          it?.unit_amount ??
          it?.variant?.price ??
          product?.price ??
          0
      ) || 0;

    const lineTotal =
      Number(it?.lineTotal ?? it?.total ?? unitPrice * quantity) || unitPrice * quantity;

    const variantType =
      it?.variantType ??
      it?.type ??
      it?.variant?.type ??
      it?.productVariant?.type ??
      it?.originalType ??
      null;

    return {
      id: it?.id ?? it?.cartItemId ?? it?.CartItemId,

      productId: it?.productId ?? product?.id,
      productVariantId: it?.productVariantId ?? it?.variantId ?? it?.variant?.id,
      originalVariantId: it?.originalVariantId ?? it?.original?.id,

      title,
      imageUrl,
      variantType,

      quantity,
      unitPrice,
      lineTotal,

      options: it?.options ?? it?.meta ?? null,
    };
  });

  const subtotal =
    Number(json?.subtotal ?? json?.cart?.subtotal) ||
    items.reduce((sum, it) => sum + (Number(it.lineTotal) || 0), 0);

  const total = Number(json?.total ?? json?.cart?.total) || subtotal;

  return { items, subtotal, total };
}

export default function CartArtworksPage() {
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartView>({ items: [], subtotal: 0, total: 0 });

  const fetchCart = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cart", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();

      setCart(normalizeCart(json));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load cart");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const handleRemove = async (item: CartItem) => {
    // Best-effort delete: prefer cartItem id, fall back to variant ids
    const body =
      item.id
        ? { cartItemId: item.id }
        : {
            productId: item.productId,
            productVariantId: item.productVariantId,
            originalVariantId: item.originalVariantId,
            quantity: item.quantity ?? 1,
          };

    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());
      await fetchCart();
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove item");
    }
  };

  const goCheckout = () => {
    router.push("/cart/artworks/checkout");
  };
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Your Cart</h1>
          <p className="mt-1 text-sm text-neutral-600">Review items before checkout.</p>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Continue shopping
        </Link>
      </div>

      {loading && <div className="mt-6 h-40 animate-pulse rounded-xl bg-neutral-100" />}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Items */}
          <section className="rounded-2xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 p-4">
              <div className="text-sm text-neutral-700">
                {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
              </div>
            </div>

            {cart.items.length === 0 ? (
              <div className="p-6 text-sm text-neutral-600">Your cart is empty.</div>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {cart.items.map((it, idx) => (
                  <li key={it.id ?? `${it.productId ?? "x"}-${idx}`} className="p-4">
                    <div className="flex gap-4">
                      <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                     
                        {it.imageUrl ? (
                          <Image
                            src={it.imageUrl}
                            alt={it.title}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-neutral-900">
                              {it.title}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-600">
                              {it.variantType ? (
                                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">
                                  {String(it.variantType)}
                                </span>
                              ) : null}
                              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">
                                Qty: {it.quantity}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-semibold text-neutral-900">
                              {money(it.lineTotal)}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {money(it.unitPrice)} each
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => handleRemove(it)}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                          >
                            Remove
                          </button>

                          {/* Optional: show options/meta */}
                          {it.options ? (
                            <div className="text-xs text-neutral-500">
                              {/* keep compact */}
                              {Object.entries(it.options).slice(0, 2).map(([k, v]) => (
                                <span key={k} className="ml-2">
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span />
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Summary */}
          <aside className="h-fit rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-medium tracking-wide text-neutral-700">Order summary</h2>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span className="text-neutral-900">{money(cart.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                <span className="text-neutral-700">Total</span>
                <span className="text-base font-semibold text-neutral-900">
                  {money(cart.total ?? cart.subtotal)}
                </span>
              </div>
            </div>

            <button
              onClick={goCheckout}
              disabled={cart.items.length === 0}
              className="mt-4 w-full rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Checkout
            </button>

            <button
              onClick={fetchCart}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
            >
              Refresh
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
