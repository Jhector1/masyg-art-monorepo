"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "./UserContext";
import {
  AddToCartResponse,
  CartSelectedItem,
  CartUpdates,
  DesignPayload,
} from "../types";
import { usePathname } from "next/navigation";

export type CartContextType = {
  cart: CartSelectedItem[];
  loadingCart: boolean;
  loadingAdd: boolean;
  totalPrice: number;
  refreshCart: () => Promise<void>;

  // ✅ no price/originalPrice here anymore; server computes
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

  // ✅ same here; include design/snapshot when needed
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
    updates: CartUpdates; // ⚠️ do not include price in updates
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
      const res = await fetch("/api/cart?liveDesignPreview=1", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json();
      setCart(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch cart:", err);
      setCart([]);
    } finally {
      setLoadingCart(false);
    }
  };

  // On auth change, refresh cart
  useEffect(() => {
    void fetchCart();
  }, [isLoggedIn]);

  // When navigating to /cart (SPA), refresh cart
  useEffect(() => {
    if (pathname?.startsWith("/cart")) {
      void fetchCart();
    }
  }, [pathname]);

  // Refresh when window regains focus / becomes visible
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

  const addToCart = async (
    productId: string,
    digitalType: string | null,
    printType: string | null,
    format: string,
    size: string | null,
    material: string | null,
    frame: string | null,
    license: string,
    quantity: number = 1
  ): Promise<AddToCartResponse> => {
    // Only block if neither user nor guest
    if (!isLoggedIn && !guestId) return { result: undefined };

    setLoadingAdd(true);
    try {
      const res = await fetch("/api/cart", {
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
          // server derives user/guest from cookies; no need to send guestId
        }),
      });

      const data = await res.json();
      await fetchCart();

      return {
        result: data?.result
          ? {
              cartItemId: data.result.cartItemId,
              digitalVariantId: data.result.digitalVariantId ?? null,
              printVariantId: data.result.printVariantId ?? null,
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
      const res = await fetch("/api/cart", {
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
          design,   // server will validate/own and snapshot
          snapshot, // freeze preview/style at add time
        }),
      });

      const data = await res.json();
      await fetchCart();

      return {
        result: data?.result
          ? {
              cartItemId: data.result.cartItemId,
              digitalVariantId: data.result.digitalVariantId ?? null,
              printVariantId: data.result.printVariantId ?? null,
              designId: data.result.designId ?? null,
              previewUrl: data.result.previewUrl ?? null,
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

  const removeFromCart = async (
    productId: string,
    _digitalVariantId: string,
    _printVariantId: string
  ) => {
    if (!isLoggedIn && !guestId) return;
    setLoadingAdd(true);
    try {
      await fetch("/api/cart", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }), // server only needs productId
      });
      await fetchCart();
    } catch (err) {
      console.error("Failed to remove from cart:", err);
    } finally {
      setLoadingAdd(false);
    }
  };

  const updateCart = async ({
    productId,
    printVariantId,
    digitalVariantId,
    updates,
  }: {
    productId: string;
    printVariantId?: string;
    digitalVariantId?: string;
    updates: CartUpdates;
  }) => {
    if (!isLoggedIn && !guestId) return;
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          printVariantId,
          digitalVariantId,
          updates, // ✅ do NOT include price; server recomputes
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to update cart:", data.error);
      } else {
        await fetchCart();
      }
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
