// src/components/shared/core/PurchaseOptionsCore.tsx
"use client";
import React from "react";

export default function PurchaseOptionsCore({
  digitalChecked,
  printChecked,
  digitalPrice,
  printPrice,
  onToggleDigital,
  onTogglePrint,
  disabled,
}: {
  digitalChecked: boolean;
  printChecked: boolean;
  digitalPrice: string | number;
  printPrice: string | number;
  onToggleDigital: () => void;
  onTogglePrint: () => void;
  disabled?: boolean;
}) {
  const isDisabled = !!disabled;
  return (
    <fieldset className="w-full">
      <legend className="block text-bold text-sm font-medium text-gray-700 mb-2">
        {" "}
        Select Your Purchase Options{" "}
        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800">
          20% off when you pick both
        </span>
      </legend>
      <p id="purchase-options-hint" className="sr-only">
        Select digital, print, or both. Buying both applies a 20% discount to
        the combined price.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Digital */}
        <label className="cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={digitalChecked}
            onChange={onToggleDigital}
            disabled={isDisabled}
          />
          <div
            className={[
              "flex items-center justify-between px-4 py-3 border rounded-xl transition",
              "border-gray-300 peer-checked:bg-purple-600 peer-checked:text-white",
              isDisabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:border-gray-400",
            ].join(" ")}
          >
            <span>Digital</span>
            <span className="font-medium">
              ${Number(digitalPrice).toFixed(2)}
            </span>
          </div>
        </label>

        {/* Print */}
        <label className="cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={printChecked}
            onChange={onTogglePrint}
            disabled={isDisabled}
          />
          <div
            className={[
              "flex items-center justify-between px-4 py-3 border rounded-xl transition",
              "border-gray-300 peer-checked:bg-purple-600 peer-checked:text-white",
              isDisabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:border-gray-400",
            ].join(" ")}
          >
            <span>Print</span>
            <span className="font-medium">
              ${Number(printPrice).toFixed(2)}
            </span>
          </div>
        </label>
      </div>
    </fieldset>
  );
}
