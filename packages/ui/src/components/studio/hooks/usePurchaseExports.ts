"use client";

import { useState, useCallback } from "react";

type Pack = 10 | 50 | 200; // change to match your products/tiers

export function usePurchaseExports(productId: string) {
  const [busy, setBusy] = useState(false);
  const startCheckout = useCallback(async (pack: Pack) => {
    setBusy(true);
    try {
      // hit your backend to create a checkout session
      const res = await fetch(`/api/billing/exports/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, pack }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Checkout failed");
      }
      const { url } = (await res.json()) as { url: string };
      if (url) window.location.assign(url);
    } catch (e: any) {
      alert(e.message || "Unable to start checkout");
    } finally {
      setBusy(false);
    }
  }, [productId]);

  return { startCheckout, busy };
}
