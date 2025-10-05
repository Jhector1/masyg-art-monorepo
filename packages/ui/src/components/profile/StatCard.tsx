// ============================================================
// File: src/components/profile/StatCard.tsx
// Compact, responsive stat card consistent with new design
// ============================================================
import React from "react";

type Props = {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  className?: string;
};

export default function StatCard({ icon, value, label, className }: Props) {
  return (
    <div
      className={[
        "snap-start min-w-[160px] md:min-w-0",
        "flex items-center gap-3 md:gap-4",
        "p-3 md:p-6 rounded-2xl bg-white/80 backdrop-blur shadow-sm ring-1 ring-black/5",
        "hover:shadow transition-shadow",
        className || "",
      ].join(" ")}
      title={`${value} ${label}`}
      aria-label={`${label}: ${value}`}
      role="group"
    >
      <div className="shrink-0 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70 p-2.5 md:p-3">
        <div className="h-5 w-5 md:h-6 md:w-6 grid place-items-center">{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-base md:text-xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="hidden md:block text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
