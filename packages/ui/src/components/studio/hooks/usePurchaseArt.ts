"use client";
import { useCallback, useState } from "react";
import type { StyleState } from "../types";

type Variant = "digital" | "print";

export function usePurchaseArt(productId: string) {
  const [busy, setBusy] = useState(false);

  const startArtCheckout = useCallback(
    async (input: {
      style: StyleState;
      defs: string;
      variant: Variant;
      quantity: number;
      // Add anything else you need (sizeId, frame, paper, etc.)
    }) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/products/${productId}/purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (res.status === 401) {
          alert("Please sign in to purchase.");
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Unable to start checkout");
        }

        const { url } = (await res.json()) as { url: string };
        if (url) window.location.assign(url);
      } catch (e: any) {
        alert(e.message || "Checkout failed");
      } finally {
        setBusy(false);
      }
    },
    [productId]
  );

  return { startArtCheckout, busy };
}
