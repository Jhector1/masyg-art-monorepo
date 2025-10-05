// File: src/app/providers.tsx
"use client";

import React from "react";
import { Toaster } from "react-hot-toast";
import { UserProvider } from "@acme/core/contexts/UserContext";
import { CartProvider } from "@acme/core/contexts/CartContext";
import { FavoriteProvider } from "@acme/core/contexts/FavoriteContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <CartProvider>
        <FavoriteProvider>
          <Toaster position="top-right" />
          {children}
        </FavoriteProvider>
      </CartProvider>
    </UserProvider>
  );
}
