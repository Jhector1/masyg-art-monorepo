"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCheckout } from "@/lib/checkout/useCheckout";
import { useResumeCheckout } from "@/lib/checkout/useResumeCheckout";
import {
  getReservationOwner,
  formatReservedUntil,
} from "@/lib/checkout/reservation";

type VariantType = "DIGITAL" | "PRINT" | "ORIGINAL";

type CartItem = {
  id?: string;
  productId?: string;

  // ✅ matches Prisma
  digitalVariantId?: string | null;
  printVariantId?: string | null;
  originalVariantId?: string | null;

  title: string;
  imageUrl?: string | null;

  variantType?: VariantType | string | null;
  quantity: number;

  unitPrice: number;
  lineTotal: number;

  originalStatus?: "ACTIVE" | "RESERVED" | "SOLD" | null;

  options?: Record<string, any> | null;

  // ✅ from original variant object in your cart payload
  originalReservedOrderId?: string | null;
  originalReservedUntil?: string | null; // ISO string
};

type CartView = {
  items: CartItem[];
  subtotal: number;
  total?: number;
};

function money(n: number) {
  return (n ?? 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

// Prisma cuid() usually starts with "c" and is long (25+)
function isCuid(v: any) {
  return typeof v === "string" && /^c[a-z0-9]{20,}$/i.test(v);
}

function formatUntil(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

    const cartItemId =
      it?.cartItemId ??
      it?.CartItemId ??
      it?.cartItem?.id ??
      it?.CartItem?.id ??
      (isCuid(it?.id) ? it.id : null);

    // ✅ your API returns variants as { digital, print, original }
    const digitalObj = it?.digitalVariant ?? it?.digital ?? null;
    const printObj = it?.printVariant ?? it?.print ?? null;
    const originalObj = it?.originalVariant ?? it?.original ?? null;

    // ✅ productId in your API is the root `id` (uuid)
    const productId =
      it?.productId ??
      it?.product?.id ??
      it?.Product?.id ??
      product?.id ??
      (isUuid(it?.id) ? it.id : null) ??
      null;

    const title =
      it?.title ??
      it?.name ??
      product?.title ??
      product?.name ??
      "Untitled item";

    const imageUrl =
      it?.previewUrlSnapshot ??
      it?.previewUrl ??
      it?.imageUrl ??
      it?.image ??
      it?.thumbnails?.[0] ??
      product?.thumbnails?.[0] ??
      product?.imageUrl ??
      null;

    // ✅ your API uses cartQuantity/cartPrice
    const quantity =
      Number(it?.cartQuantity ?? it?.quantity ?? it?.qty ?? 1) || 1;

    const unitPrice =
      Number(
        it?.cartPrice ?? it?.price ?? it?.unitPrice ?? product?.price ?? 0
      ) || 0;

    const lineTotal =
      Number(it?.lineTotal ?? it?.total) || unitPrice * quantity;

    const digitalVariantId = it?.digitalVariantId ?? digitalObj?.id ?? null;
    const printVariantId = it?.printVariantId ?? printObj?.id ?? null;
    const originalVariantId = it?.originalVariantId ?? originalObj?.id ?? null;

    const originalStatus = it?.originalStatus ?? originalObj?.status ?? null;

    const variantType =
      it?.variantType ??
      it?.type ??
      (originalVariantId
        ? "ORIGINAL"
        : digitalVariantId
          ? "DIGITAL"
          : printVariantId
            ? "PRINT"
            : null);

    const originalReservedOrderId = originalObj?.reservedOrderId ?? null;
    const originalReservedUntil = originalObj?.reservedUntil ?? null;

    return {
      id: cartItemId ?? undefined,
      productId: productId ?? undefined,
      digitalVariantId,
      printVariantId,
      originalVariantId,
      title,
      imageUrl,
      variantType,
      quantity,
      unitPrice,
      lineTotal,
      options: it?.styleSnapshot ?? it?.options ?? it?.meta ?? null,
      originalStatus,
      originalReservedOrderId,
      originalReservedUntil,
    };
  });

  const subtotal =
    Number(json?.subtotal ?? json?.cart?.subtotal) ||
    items.reduce((sum, it) => sum + (Number(it.lineTotal) || 0), 0);

  const total = Number(json?.total ?? json?.cart?.total) || subtotal;

  return { items, subtotal, total };
}

type BlockReason =
  | "SOLD"
  | "RESERVED_YOU"
  | "RESERVED_OTHER"
  | "CHECKING"
  | null;

function badgeText(reason: Exclude<BlockReason, null>) {
  switch (reason) {
    case "SOLD":
      return "Sold";
    case "RESERVED_YOU":
      return "Reserved (you)";
    case "RESERVED_OTHER":
      return "Reserved";
    case "CHECKING":
      return "Checking…";
  }
}

function badgeClasses(reason: Exclude<BlockReason, null>) {
  switch (reason) {
    case "SOLD":
      return "border-red-200 bg-red-50 text-red-700";
    case "RESERVED_OTHER":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "RESERVED_YOU":
      return "border-neutral-200 bg-neutral-50 text-neutral-800";
    case "CHECKING":
      return "border-neutral-200 bg-white text-neutral-600";
  }
}

function rowTint(reason: Exclude<BlockReason, null>) {
  switch (reason) {
    case "SOLD":
      return "bg-red-50/40";
    case "RESERVED_OTHER":
      return "bg-amber-50/40";
    case "RESERVED_YOU":
      return "bg-neutral-50/30";
    case "CHECKING":
      return "";
  }
}

export default function CartArtworksPage() {
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [cart, setCart] = React.useState<CartView>({
    items: [],
    subtotal: 0,
    total: 0,
  });

  // const [resume, setResume] = React.useState<ResumeInfo | null>(null);
  // const [resumeState, setResumeState] = React.useState<"idle" | "loading" | "done">("idle");

  const fetchCart = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/private/cart", {
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

  // const fetchResume = React.useCallback(async () => {
  //   setResumeState("loading");
  //   try {
  //     const res = await fetch("/api/private/checkout/resume", {
  //       cache: "no-store",
  //       credentials: "include",
  //     });

  //     if (!res.ok) {
  //       setResume(null);
  //       setResumeState("done");
  //       return;
  //     }

  //     const json = await res.json();
  //     // requires { url, orderId }
  //     if (json?.url && json?.orderId) {
  //       setResume({ url: json.url, orderId: json.orderId, expiresAt: json.expiresAt ?? null });
  //     } else {
  //       setResume(null);
  //     }
  //   } catch {
  //     setResume(null);
  //   } finally {
  //     setResumeState("done");
  //   }
  // }, []);

  const { checkout, busy: checkoutBusy } = useCheckout({
    onError: (msg) => setError(msg),
  });

  React.useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // If any ORIGINAL is reserved, try to get a resume link (to know if reserved is “yours”)
  // React.useEffect(() => {
  //   const hasReserved = cart.items.some(
  //     (it) => it.variantType === "ORIGINAL" && it.originalStatus === "RESERVED"
  //   );
  //   if (!hasReserved) {
  //     setResume(null);
  //     setResumeState("idle");
  //     return;
  //   }
  //   // don’t spam; fetch once per cart change
  //   fetchResume();
  // }, [cart.items, fetchResume]);

  const handleRemove = async (item: CartItem) => {
    const body = item.id
      ? { cartItemId: item.id }
      : {
          productId: item.productId,
          productVariantId: item.originalVariantId,
          originalVariantId: item.originalVariantId,
          quantity: item.quantity ?? 1,
        };

    try {
      const res = await fetch("/api/private/cart", {
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

  const handleCheckout = async () => {
    const cartItemIds = cart.items.map((x) => x.id).filter(Boolean) as string[];

    if (!cartItemIds.length) {
      setError("No items to checkout.");
      return;
    }

    await checkout(cartItemIds.map((id) => ({ cartItemId: id })));
  };

  // --------- reason logic (THIS is the key change) ----------
  // function blockReason(it: CartItem): BlockReason {
  //   if (it.variantType !== "ORIGINAL") return null;

  //   if (it.originalStatus === "SOLD") return "SOLD";

  //   if (it.originalStatus === "RESERVED") {
  //     // While we’re fetching resume info, show “Checking…” instead of telling user to remove
  //     if (resumeState === "loading") return "CHECKING";

  //     const reservedOrderId = it.originalReservedOrderId;
  //     const reservedByMe =
  //       Boolean(resume?.orderId) &&
  //       Boolean(reservedOrderId) &&
  //       resume!.orderId === reservedOrderId;

  //     return reservedByMe ? "RESERVED_YOU" : "RESERVED_OTHER";
  //   }

  //   return null;
  // }

  // ✅ reservation lookup only when needed
  const hasAnyReserved = React.useMemo(
    () =>
      cart.items.some(
        (it) =>
          it.variantType === "ORIGINAL" && it.originalStatus === "RESERVED"
      ),
    [cart.items]
  );

  const { resume, state: resumeState } = useResumeCheckout(hasAnyReserved);

  function blockReason(it: CartItem): BlockReason {
    if (it.variantType !== "ORIGINAL") return null;

    const owner = getReservationOwner({
      status: it.originalStatus ?? null,
      reservedOrderId: it.originalReservedOrderId ?? null,
      resume,
      resumeState,
    });

    if (owner === "SOLD") return "SOLD";
    if (owner === "CHECKING") return "CHECKING";
    if (owner === "YOU") return "RESERVED_YOU";
    if (owner === "OTHER") return "RESERVED_OTHER";
    return null;
  }

  const blockedItems = React.useMemo(() => {
    return cart.items.filter((it) => {
      const r = blockReason(it);
      return r === "SOLD" || r === "RESERVED_OTHER";
    });
  }, [cart.items, resume, resumeState]); // uses blockReason closure values

  const hasSold = blockedItems.some((it) => blockReason(it) === "SOLD");
  const hasReservedOther = blockedItems.some(
    (it) => blockReason(it) === "RESERVED_OTHER"
  );

  // ✅ block only if SOLD or RESERVED by someone else
  const blockCheckout = hasSold || hasReservedOther;

  // ✅ show resume if any item is RESERVED_YOU and we have a url
  const canResume =
    cart.items.some((it) => blockReason(it) === "RESERVED_YOU") &&
    !!resume?.url;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Your Cart
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Review items before checkout.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Continue shopping
        </Link>
      </div>

      {loading && (
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-neutral-100" />
      )}

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
              <div className="p-6 text-sm text-neutral-600">
                Your cart is empty.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {cart.items.map((it, idx) => {
                  const reason = blockReason(it);
                  const until = formatReservedUntil(it.originalReservedUntil);

                  const showRemoveHint =
                    reason === "SOLD" || reason === "RESERVED_OTHER";

                  return (
                    <li
                      key={it.id ?? `${it.productId ?? "x"}-${idx}`}
                      className={["p-4", reason ? rowTint(reason) : ""].join(
                        " "
                      )}
                    >
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

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                                {it.variantType ? (
                                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">
                                    {String(it.variantType)}
                                  </span>
                                ) : null}

                                {reason ? (
                                  <span
                                    className={[
                                      "rounded-full border px-2 py-0.5 font-medium",
                                      badgeClasses(reason),
                                    ].join(" ")}
                                    title={
                                      reason === "SOLD"
                                        ? "This artwork is already sold."
                                        : reason === "RESERVED_OTHER"
                                          ? "This artwork is reserved in another checkout."
                                          : reason === "RESERVED_YOU"
                                            ? "This artwork is reserved by you. Resume your checkout."
                                            : "Checking reservation…"
                                    }
                                  >
                                    {badgeText(reason)}
                                  </span>
                                ) : null}

                                {until && it.originalStatus === "RESERVED" ? (
                                  <span className="text-xs text-neutral-500">
                                    until {until}
                                  </span>
                                ) : null}

                                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">
                                  Qty: {it.quantity}
                                </span>

                                {showRemoveHint ? (
                                  <span className="text-xs font-medium text-neutral-700">
                                    — remove to continue
                                  </span>
                                ) : null}
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
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRemove(it)}
                                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                              >
                                Remove
                              </button>

                              {reason === "RESERVED_YOU" && resume?.url ? (
                                <button
                                  onClick={() =>
                                    window.location.assign(resume.url)
                                  }
                                  className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                                >
                                  Resume
                                </button>
                              ) : null}
                            </div>

                            {/* Optional: show options/meta */}
                            {it.options ? (
                              <div className="text-xs text-neutral-500">
                                {Object.entries(it.options)
                                  .slice(0, 2)
                                  .map(([k, v]) => (
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
                  );
                })}
              </ul>
            )}
          </section>

          {/* Summary */}
          <aside className="h-fit rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-medium tracking-wide text-neutral-700">
              Order summary
            </h2>

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

            {/* Primary action */}
            {canResume ? (
              <button
                onClick={() => window.location.assign(resume!.url)}
                className="mt-4 w-full rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Resume checkout
              </button>
            ) : !blockCheckout ? (
              <button
                onClick={handleCheckout}
                disabled={checkoutBusy || cart.items.length === 0}
                className="mt-4 w-full rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkoutBusy ? "Starting checkout…" : "Checkout"}
              </button>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Some items can’t be checked out.
                <div className="mt-2 space-y-1">
                  {blockedItems.slice(0, 3).map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate">{it.title}</span>
                      <span className="shrink-0 font-medium">
                        {blockReason(it) === "SOLD" ? "Sold" : "Reserved"}
                      </span>
                    </div>
                  ))}
                  {blockedItems.length > 3 ? (
                    <div className="text-xs text-amber-800/80">
                      +{blockedItems.length - 3} more
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-amber-900/80">
                  Remove the highlighted item(s) to continue.
                </div>
              </div>
            )}

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
