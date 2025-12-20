"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "./UserContext";

type RefreshFavoritesArgs = { types?: string };

type FavoriteContextProps = {
  favorites: Set<string>;
  ready: boolean;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  addFavorite: (productId: string) => Promise<void>;
  removeFavorite: (productId: string) => Promise<void>;
  refreshFavorites: (args?: RefreshFavoritesArgs) => Promise<void>; // ✅ accept optional args
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

const [ready, setReady] = useState(false);

const refreshFavorites = async (args: { types?: string } = {}) => {
  const types = args.types?.trim() ?? "";

  const qs = new URLSearchParams();
  if (types) qs.set("types", types);

  // ✅ (optional but recommended) set site per app
  // qs.set("site", process.env.NEXT_PUBLIC_SITE ?? "Storefront");

  const url = qs.toString() ? `/api/favorite?${qs}` : "/api/favorite";

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });

    if (!res.ok) return;

    const data = await res.json();

    const arr =
      Array.isArray(data) ? data :
      Array.isArray(data?.favorites) ? data.favorites :
      Array.isArray(data?.favoriteIds) ? data.favoriteIds :
      [];

    const ids = new Set<string>(
      arr.map((x: any) => String(x?.id ?? x?.productId ?? x?.product?.id ?? x)).filter(Boolean)
    );

    setFavorites(ids);
  } catch (err) {
    console.error("Failed to refresh favorites:", err);
  } finally {
    setReady(true);
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

const toggleFavorite = async (productId: string) => {
  if (isFavorite(productId)) await removeFavorite(productId);
  else await addFavorite(productId);
};



  return (
    <FavoriteContext.Provider
      value={{
        ready,
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
