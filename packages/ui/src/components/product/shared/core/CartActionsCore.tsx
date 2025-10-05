// src/components/shared/core/CartActionsCore.tsx
"use client";
import React, { useState } from "react";

export default function CartActionsCore({
  inCart,
  loading,
  onToggleCart,
  onCheckout,
  disabled,
}: {
  inCart: boolean;
  loading: boolean;
  onToggleCart: () => void;
  onCheckout: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const addRemoveDisabled = (!!disabled && !inCart) || loading;

  const handleCheckoutClick = async () => {
    setCheckoutLoading(true);
    try {
      await onCheckout();
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <button
        onClick={onToggleCart}
        disabled={addRemoveDisabled}
        className={[
          "w-full font-semibold px-5 py-3 rounded-xl shadow-sm transition",
          inCart
            ? "bg-white hover:bg-gray-100 text-purple-600 border-2 border-purple-600"
            : "bg-white hover:bg-gray-100 text-gray-900 border border-gray-300",
          addRemoveDisabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {loading ? (inCart ? "Removing…" : "Adding…") : inCart ? "Remove from Cart" : "Add Selected to Cart"}
      </button>

      <button
        onClick={handleCheckoutClick}
        disabled={!!disabled || checkoutLoading}
        className={[
          "w-full bg-purple-600 text-white font-semibold px-5 py-3 rounded-xl shadow-sm transition",
          "hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
          (disabled || checkoutLoading) ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {checkoutLoading ? "Processing…" : "Proceed to Checkout"}
      </button>
    </div>
  );
}
