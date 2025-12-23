"use client";

import * as React from "react";

type CheckoutEntry =
  | { cartItemId: string; quantity?: number }
  | { productId: string; originalVariantId: string; quantity?: number };

export function useCheckout(opts?: { onError?: (msg: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const checkout = React.useCallback(
    async (cartProductList: CheckoutEntry[]) => {
      setError(null);

      if (!Array.isArray(cartProductList) || cartProductList.length === 0) {
        const msg = "No items to checkout.";
        setError(msg);
        opts?.onError?.(msg);
        return;
      }

      setBusy(true);
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ cartProductList }),
        });

        const out = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = out?.message ?? out?.error ?? (await res.text()) ?? "Checkout failed";
          throw new Error(msg);
        }

        if (out?.url) window.location.href = out.url;
        else throw new Error("Checkout did not return a redirect URL.");
      } catch (e: any) {
        const msg = e?.message ?? "Checkout failed";
        setError(msg);
        opts?.onError?.(msg);
      } finally {
        setBusy(false);
      }
    },
    [opts]
  );

  return { checkout, busy, error };
}
