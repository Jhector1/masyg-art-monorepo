// src/components/shared/core/LicenseSelectorCore.tsx
"use client";

import React from "react";
import Image from "next/image";
import type { LicenseOption } from "@acme/core/types";

const ICON_SRC: Record<string, string> = {
  personal:   "/license-icons/personal.png",   // house + heart
  commercial: "/license-icons/commercial.png", // briefcase + check
  extended:   "/license-icons/extended.png",   // crown + star
};

export default function LicenseSelectorCore({
  selected,
  licenses,
  onSelect,
  disabled,
}: {
  selected: LicenseOption;
  licenses: LicenseOption[];
  onSelect: (license: LicenseOption) => void;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800">Choose License</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {licenses.map((license) => {
          const isSelected = selected.type === license.type;

          return (
            <button
              key={license.type}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onSelect(license)}
              className={[
                "group text-left rounded-2xl border-2 p-4 transition-all",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/5",
                isSelected ? "border-black shadow-md bg-gray-50"
                           : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
                disabled ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="shrink-0 rounded-full ring-1 ring-black/10 p-1 bg-white/70">
                  <Image
                    src={ICON_SRC[license.type] ?? ICON_SRC.personal}
                    alt={`${license.name} icon`}
                    width={44}
                    height={44}
                    className="h-10 w-10 object-contain"
                  />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4
                      className="text-sm sm:text-base font-medium text-gray-900 truncate"
                      title={license.name}
                    >
                      {license.name}
                    </h4>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      {license.type === "personal" ? "FREE" : `$${license.price}`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{license.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
