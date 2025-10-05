// src/components/shared/core/SizeSelectorCore.tsx
"use client";
import React from "react";

export type SizeOption = { label: string; multiplier?: number };

export default function SizeSelectorCore({
  options,
  selected,
  isCustom,
  customSize,
  onSelect,
  onCustomChange,
  disabled,
}: {
  options: SizeOption[];
  selected: SizeOption;
  isCustom: boolean;
  customSize: { width: string; height: string };
  onSelect: (sel: SizeOption) => void;
  onCustomChange: (custom: { width: string; height: string }) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="w-full">
      <legend className="block text-sm font-medium text-gray-700 mb-2">Print Size</legend>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {options.map((opt) => (
          <label key={opt.label} className="cursor-pointer">
            <input
              type="radio"
              name="size"
              className="sr-only peer"
              value={opt.label}
              checked={selected?.label === opt.label}
              onChange={() => onSelect(opt)}
              disabled={disabled}
            />
            <span className={[
              "block text-center px-4 py-2 border rounded-lg transition",
              "border-gray-300 peer-checked:bg-purple-600 peer-checked:text-white",
              disabled ? "opacity-50 cursor-not-allowed" : "hover:border-gray-400",
            ].join(" ")}
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      {isCustom && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <label className="text-sm text-gray-600">Custom:</label>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300">
            <input
              type="number"
              placeholder="W"
              className="w-20 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={customSize.width}
              onChange={(e) => onCustomChange({ width: e.target.value, height: customSize.height })}
              disabled={disabled}
            />
            <span className="px-2 border-l border-gray-300 text-gray-500">×</span>
            <input
              type="number"
              placeholder="H"
              className="w-20 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={customSize.height}
              onChange={(e) => onCustomChange({ width: customSize.width, height: e.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
