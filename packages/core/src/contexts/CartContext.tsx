"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "./UserContext";
import type {
  AddToCartResponse,
  CartSelectedItem,
  CartUpdates,
  DesignPayload,
} from "../types";
import { usePathname } from "next/navigation";

/** Read JSON safely: avoids "Unexpected end of JSON input" */
async function readJsonSafe<T = any>(res: Response): Promise<T | null> {
  const text = await res.text(); // read once
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // In case something returns HTML/text
    return null;
  }
}

export type CartContextType = {
  cart: CartSelectedItem[];
  loadingCart: boolean;
  loadingAdd: boolean;
  totalPrice: number;
  refreshCart: () => Promise<void>;

  addToCart: (
    productId: string,
    digitalType: string | null,
    printType: string | null,
    format: string,
    size: string | null,
    material: string | null,
    frame: string | null,
    license: string,
    quantity?: number
  ) => Promise<AddToCartResponse>;

  addToCartWithDesign: (args: {
    productId: string;
    digitalType: string | null;
    printType: string | null;
    format: string;
    size: string | null;
    material: string | null;
    frame: string | null;
    license: string;
    quantity?: number;
    design?: DesignPayload;
    snapshot?: boolean;
  }) => Promise<AddToCartResponse>;

  removeFromCart: (
    productId: string,
    digitalVariantId: string,
    printVariantId: string
  ) => Promise<void>;

  updateCart: (args: {
    productId: string;
    printVariantId?: string;
    digitalVariantId?: string;
    updates: CartUpdates;
  }) => Promise<void>;
};

const defaultContext: CartContextType = {
  cart: [],
  loadingCart: false,
  loadingAdd: false,
  totalPrice: 0,
  refreshCart: async () => {},
  addToCart: async () => ({ result: undefined }),
  addToCartWithDesign: async () => ({ result: undefined }),
  removeFromCart: async () => {},
  updateCart: async () => {},
};

const CartContext = createContext<CartContextType>(defaultContext);
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, guestId } = useUser();
  const [cart, setCart] = useState<CartSelectedItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const pathname = usePathname();

  const fetchCart = async () => {
    setLoadingCart(true);
    try {
      const res = await fetch("/api/private/cart?liveDesignPreview=1", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { "Cache-Control": "no-store" },
      });

      // ✅ SAFE parse
      const data = await readJsonSafe(res);

      if (!res.ok) {
        // data might be null (empty body). Still no crash.
        console.error("Failed to fetch cart:", res.status, data);
        setCart([]);
        return;
      }

      setCart(Array.isArray(data) ? (data as CartSelectedItem[]) : []);
    } catch (err) {
      console.error("Failed to fetch cart:", err);
      setCart([]);
    } finally {
      setLoadingCart(false);
    }
  };

  useEffect(() => {
    void fetchCart();
  }, [isLoggedIn]);

  useEffect(() => {
    if (pathname?.startsWith("/cart")) void fetchCart();
  }, [pathname]);

  useEffect(() => {
    const onFocus = () => void fetchCart();
    const onVis = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const addToCart: CartContextType["addToCart"] = async (
    productId,
    digitalType,
    printType,
    format,
    size,
    material,
    frame,
    license,
    quantity = 1
  ) => {
    if (!isLoggedIn && !guestId) return { result: undefined };

    setLoadingAdd(true);
    try {
      const res = await fetch("/api/private/cart", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          digitalType,
          printType,
          quantity,
          format,
          size,
          material,
          frame,
          license,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        console.error("Failed to add to cart:", res.status, data);
        return { result: undefined };
      }

      await fetchCart();

      return {
        result: (data as any)?.result
          ? {
              cartItemId: (data as any).result.cartItemId,
              digitalVariantId: (data as any).result.digitalVariantId ?? null,
              printVariantId: (data as any).result.printVariantId ?? null,
            }
          : undefined,
      };
    } catch (err) {
      console.error("Failed to add to cart:", err);
      return { result: undefined };
    } finally {
      setLoadingAdd(false);
    }
  };

  const addToCartWithDesign: CartContextType["addToCartWithDesign"] = async ({
    productId,
    digitalType,
    printType,
    format,
    size,
    material,
    frame,
    license,
    quantity = 1,
    design,
    snapshot = true,
  }) => {
    if (!isLoggedIn && !guestId) return { result: undefined };

    setLoadingAdd(true);
    try {
      const res = await fetch("/api/private/cart", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          digitalType,
          printType,
          quantity,
          format,
          size,
          material,
          frame,
          license,
          design,
          snapshot,
        }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        console.error("Failed to add to cart (with design):", res.status, data);
        return { result: undefined };
      }

      await fetchCart();

      return {
        result: (data as any)?.result
          ? {
              cartItemId: (data as any).result.cartItemId,
              digitalVariantId: (data as any).result.digitalVariantId ?? null,
              printVariantId: (data as any).result.printVariantId ?? null,
              designId: (data as any).result.designId ?? null,
              previewUrl: (data as any).result.previewUrl ?? null,
            }
          : undefined,
      };
    } catch (err) {
      console.error("Failed to add to cart (with design):", err);
      return { result: undefined };
    } finally {
      setLoadingAdd(false);
    }
  };

  const removeFromCart: CartContextType["removeFromCart"] = async (
    productId
    // digitalVariantId, printVariantId not needed server-side
  ) => {
    if (!isLoggedIn && !guestId) return;

    setLoadingAdd(true);
    try {
      const res = await fetch("/api/private/cart", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        console.error("Failed to remove from cart:", res.status, data);
        return;
      }

      await fetchCart();
    } catch (err) {
      console.error("Failed to remove from cart:", err);
    } finally {
      setLoadingAdd(false);
    }
  };

  const updateCart: CartContextType["updateCart"] = async ({
    productId,
    printVariantId,
    digitalVariantId,
    updates,
  }) => {
    if (!isLoggedIn && !guestId) return;

    try {
      const res = await fetch("/api/private/cart", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          printVariantId,
          digitalVariantId,
          updates,
        }),
      });

      // ✅ SAFE parse (may be null if empty)
      const data = await readJsonSafe(res);

      if (!res.ok) {
        console.error("Failed to update cart:", res.status, data);
        return; // ✅ no crash
      }

      await fetchCart();
    } catch (err) {
      console.error("Error updating cart:", err);
    }
  };

  const totalPrice = Array.isArray(cart)
    ? cart.reduce((sum, item) => sum + item.cartPrice * item.cartQuantity, 0)
    : 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        loadingCart,
        loadingAdd,
        totalPrice,
        refreshCart: fetchCart,
        addToCart,
        addToCartWithDesign,
        removeFromCart,
        updateCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
