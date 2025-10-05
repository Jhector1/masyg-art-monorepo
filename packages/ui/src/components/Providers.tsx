// File: src/components/Providers.tsx
"use client";

import React from "react";
import { UserProvider } from "@acme/core/contexts/UserContext";
import { CartProvider } from "@acme/core/contexts/CartContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <CartProvider>{children}</CartProvider>
    </UserProvider>
  );
}
