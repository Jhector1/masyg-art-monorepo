"use client";
import { useCallback, useEffect, useState } from "react";
import {
  getCurrentStorefront, getStoreCart, setStoreVariantQuantity,
  type CartQuote,
} from "../lib/client/storefront-commerce";

/** Browser-only cart controller. No product prices, merchant IDs or payment sessions are client-authored. */
export function useStoreCart() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Store selection is resolved by server-verified Host. Never fall back to a hardcoded store.
      const context = await getCurrentStorefront();
      const current = await getStoreCart(context.store.id);
      setStoreId(context.store.id);
      setQuote(current);
    } catch (cause) {
      setQuote(null);
      setStoreId(null);
      setError(cause instanceof Error ? cause.message : "Unable to load cart");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const context = await getCurrentStorefront();
        const current = await getStoreCart(context.store.id);
        if (live) { setStoreId(context.store.id); setQuote(current); }
      } catch (cause) {
        if (live) setError(cause instanceof Error ? cause.message : "Unable to load cart");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const setQuantity = useCallback(async (variantId: string, quantity: number) => {
    if (!storeId || busyVariantId !== null) return;
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 20) {
      setError("Quantity must be between 0 and 20");
      return;
    }
    setBusyVariantId(variantId);
    setError(null);
    try {
      const current = await setStoreVariantQuantity(storeId,variantId,quantity);
      setQuote(current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update cart");
    } finally {
      setBusyVariantId(null);
    }
  }, [storeId, busyVariantId]);

  return { storeId, quote, loading, busyVariantId, error, reload, setQuantity };
}
