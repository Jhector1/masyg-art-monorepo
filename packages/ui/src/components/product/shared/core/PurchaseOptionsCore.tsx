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
  allowDigital,
  allowPrint,
}: {
  digitalChecked: boolean;
  printChecked: boolean;
  digitalPrice: string | number;
  printPrice: string | number;
  onToggleDigital: () => void;
  onTogglePrint: () => void;
  disabled?: boolean;
  allowDigital?: boolean;
  allowPrint?: boolean;
}) {
  const isDisabled = !!disabled;

  if (!allowDigital && !allowPrint) return null;

  return (
    <fieldset className="w-full">
      <legend className="block text-bold text-sm font-medium text-gray-700 mb-2">
        Select Your Purchase Options{" "}
        {allowDigital && allowPrint && (
          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            20% off when you pick both
          </span>
        )}
      </legend>

      <div className={`grid gap-3 ${allowDigital && allowPrint ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        {allowDigital && (
          <label className="cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={digitalChecked} onChange={onToggleDigital} disabled={isDisabled} />
            <div className={[
              "flex items-center justify-between px-4 py-3 border rounded-xl transition",
              "border-gray-300 peer-checked:bg-purple-600 peer-checked:text-white",
              isDisabled ? "opacity-50 cursor-not-allowed" : "hover:border-gray-400",
            ].join(" ")}>
              <span>Digital</span>
              <span className="font-medium">${Number(digitalPrice).toFixed(2)}</span>
            </div>
          </label>
        )}

        {allowPrint && (
          <label className="cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={printChecked} onChange={onTogglePrint} disabled={isDisabled} />
            <div className={[
              "flex items-center justify-between px-4 py-3 border rounded-xl transition",
              "border-gray-300 peer-checked:bg-purple-600 peer-checked:text-white",
              isDisabled ? "opacity-50 cursor-not-allowed" : "hover:border-gray-400",
            ].join(" ")}>
              <span>Print</span>
              <span className="font-medium">${Number(printPrice).toFixed(2)}</span>
            </div>
          </label>
        )}
      </div>
    </fieldset>
  );
}
