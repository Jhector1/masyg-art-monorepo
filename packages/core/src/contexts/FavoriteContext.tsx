"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "./UserContext";

type FavoriteContextProps = {
  favorites: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  addFavorite: (productId: string) => void;
  removeFavorite: (productId: string) => void;
  refreshFavorites: () => void;
};

const FavoriteContext = createContext<FavoriteContextProps | undefined>(
  undefined
);

export const useFavorites = (): FavoriteContextProps => {
  const ctx = useContext(FavoriteContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoriteProvider");
  return ctx;
};

export const FavoriteProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isLoggedIn, authAction, sessionPulse } = useUser();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const refreshFavorites = async () => {
    if (!isLoggedIn) return; // don’t clear on transient flips
    try {
      const res = await fetch(`/api/favorite`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      if (!res.ok) return;
      const data = await res.json();
      // robust id extraction
      const ids = new Set<string>(
        (Array.isArray(data) ? data : []).map((p: any) =>
          String(p?.id ?? p?.productId ?? p?.product?.id ?? p?.product_id)
        )
      );
      setFavorites(ids);
    } catch (err) {
      console.error("Failed to refresh favorites:", err);
    }
  };

  // refresh when auth flips & on pulses
  useEffect(() => {
    void refreshFavorites();
  }, [isLoggedIn, sessionPulse]);

  // clear only on confirmed logout
  useEffect(() => {
    if (!isLoggedIn && authAction === "logout") {
      setFavorites(new Set());
    }
  }, [isLoggedIn, authAction]);

  const isFavorite = (productId: string) => favorites.has(productId);

  const addFavorite = async (productId: string) => {
    if (!isLoggedIn) return;
    const res = await fetch("/api/favorite", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) setFavorites((prev) => new Set(prev).add(productId));
  };

  const removeFavorite = async (productId: string) => {
    if (!isLoggedIn) return;
    const res = await fetch("/api/favorite", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) {
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const toggleFavorite = (productId: string) => {
    if (isFavorite(productId)) removeFavorite(productId);
    else addFavorite(productId);
  };

  return (
    <FavoriteContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        addFavorite,
        removeFavorite,
        refreshFavorites,
      }}
    >
      {children}
    </FavoriteContext.Provider>
  );
};
