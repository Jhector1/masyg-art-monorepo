// File: src/lib/client/startCheckout.ts
"use client";

type StartCheckoutOptions = {
  onCompletePath?: string; // optional: where to send folks after completion
  onPurchaseComplete?: () => void;
};

/**
 * Calls /api/checkout with { cartProductList: [...] }.
 * If the server returns embedded flow, it dispatches "open-checkout" with clientSecret.
 * Else, it redirects to the hosted checkout URL.
 */
export async function startCheckout(orderList: any, opts?: StartCheckoutOptions) {
  const res = await fetch("/api/checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderList),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "checkout_failed");

  if (data.flow === "embedded" && data.clientSecret) {
    const detail = {
      clientSecret: data.clientSecret as string,
      exportHref: opts?.onCompletePath,
      onPurchaseComplete: opts?.onPurchaseComplete,
    };
    window.dispatchEvent(new CustomEvent("open-checkout", { detail }));
    return;
  }

  if (data.flow === "redirect" && data.url) {
    window.location.assign(data.url);
    return;
  }

  throw new Error("Unexpected checkout response shape");
}
