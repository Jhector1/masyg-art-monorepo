"use client";
// SaleAndCountdown.tsx

import * as React from "react";

// This matches the object returned by getEffectiveSale(...)
type SaleView = {
  price: number;
  compareAt: number | null;
  onSale: boolean;
  endsAt: Date | string | null;
};

type CurrencyOpts = {
  currency?: string; // e.g. "USD"
  locale?: string;   // e.g. "en-US"
};

export function SaleAndCountdown({
  price,
  compareAt,
  onSale,
  endsAt,
  className,
  currency = "USD",
  locale = "en-US",
}: (SaleView & { className?: string }) & CurrencyOpts) {
  const pctOff =
    onSale && compareAt && compareAt > 0
      ? Math.max(0, Math.round(100 * (1 - price / compareAt)))
      : 0;

  const endDate =
    endsAt ? (typeof endsAt === "string" ? new Date(endsAt) : endsAt) : null;
  const endTimeValid = endDate ? !isNaN(endDate.getTime()) : false;

  const container =
    className ??
    [
      "w-full rounded-2xl ring-1 ring-black/5 bg-white",
      "p-3 sm:p-4",
      "flex flex-col sm:flex-row sm:items-center justify-between",
      "gap-2 sm:gap-3",
    ].join(" ");

  return (
    <div className={container}>
      {/* Price block */}
      <div className="min-w-0 flex items-center gap-2 sm:gap-3">
        <PriceTag
          amount={price}
          currency={currency}
          locale={locale}
          size="lg"
          className="text-emerald-900"
          ariaLabel={`Current price ${price.toFixed(2)} ${currency}`}
        />

        {onSale && compareAt != null && (
          <div className="shrink-0">
            <PriceTag
              amount={compareAt}
              currency={currency}
              locale={locale}
              size="sm"
              strike
              className="text-gray-400"
              ariaLabel={`Original price ${compareAt.toFixed(2)} ${currency}`}
            />
          </div>
        )}

        {onSale && pctOff > 0 && (
          <span
            className="shrink-0 text-[10px] sm:text-xs font-semibold text-white bg-red-600 rounded-full px-1.5 py-0.5 sm:px-2"
            aria-label={`${pctOff} percent off`}
          >
            -{pctOff}%
          </span>
        )}
      </div>

      {/* Countdown sits right on wide, below on mobile */}
      {onSale && endTimeValid && <SaleCountdown endsAt={endDate!} />}
    </div>
  );
}

/** Pretty currency with symbol / integer / cents sized nicely */
function PriceTag({
  amount,
  currency = "USD",
  locale = "en-US",
  size = "lg",
  strike = false,
  className = "",
  ariaLabel,
}: {
  amount: number;
  currency?: string;
  locale?: string;
  size?: "lg" | "md" | "sm";
  strike?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount);

  const sym = parts.find((p) => p.type === "currency")?.value ?? "$";
  const integer = parts.filter((p) => p.type === "integer" || p.type === "group").map((p) => p.value).join("");
  const fraction = parts.find((p) => p.type === "fraction")?.value ?? "00";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";

  const sizeMap = {
    lg: {
      sym: "text-base sm:text-lg",
      int: "text-3xl sm:text-4xl lg:text-5xl",
      frac: "text-base sm:text-lg",
    },
    md: {
      sym: "text-sm sm:text-base",
      int: "text-2xl sm:text-3xl",
      frac: "text-sm sm:text-base",
    },
    sm: {
      sym: "text-xs",
      int: "text-lg",
      frac: "text-xs",
    },
  }[size];

  return (
    <span
      className={[
        "inline-flex items-baseline gap-1 font-semibold tabular-nums",
        strike ? "line-through" : "",
        className,
      ].join(" ")}
      aria-label={ariaLabel}
    >
      <span className={["opacity-80", sizeMap.sym].join(" ")}>{sym}</span>
      <span className={["leading-none", sizeMap.int].join(" ")}>{integer}</span>
      <span className={["opacity-80 leading-none", sizeMap.frac].join(" ")}>
        {decimal}
        {fraction}
      </span>
    </span>
  );
}

/** Polished countdown: days badge + HH:MM:SS, urgency color under 1h */
export function SaleCountdown({ endsAt }: { endsAt: Date }) {
  const [leftMs, setLeftMs] = React.useState(() => endsAt.getTime() - Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setLeftMs(endsAt.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (leftMs <= 0) return null;

  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;

  const d = Math.floor(leftMs / day);
  const h = Math.floor((leftMs % day) / hour);
  const m = Math.floor((leftMs % hour) / minute);
  const s = Math.floor((leftMs % minute) / second);
  const pad = (n: number) => n.toString().padStart(2, "0");

  const urgent = leftMs < hour;
  const baseRing = urgent ? "ring-rose-300" : "ring-emerald-200";
  const baseText = urgent ? "text-rose-700" : "text-emerald-700";
  const subText = urgent ? "text-rose-700/70" : "text-emerald-700/70";

  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2"
      role="status"
      aria-live="polite"
      title={`Ends ${endsAt.toLocaleString()}`}
    >
      {d > 0 && (
        <span
          className={[
            "inline-flex items-center gap-1",
            "px-2 py-1 rounded-full text-xs sm:text-sm font-medium",
            "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
            "whitespace-nowrap",
          ].join(" ")}
          aria-label={`${d} ${d === 1 ? "day" : "days"} remaining`}
        >
          <span className="tabular-nums">{d}</span>
          <span>{d === 1 ? "day" : "days"}</span>
        </span>
      )}

      <div
        className={[
          "flex items-stretch rounded-xl overflow-hidden",
          "ring-1", baseRing,
          "bg-gradient-to-br from-emerald-50 to-white",
          urgent && "from-rose-50",
        ].join(" ")}
        aria-label={`Time left ${d} days ${h} hours ${m} minutes ${s} seconds`}
      >
        <TimeSegment value={pad(h)} label="h" baseText={baseText} subText={subText} />
        <Separator />
        <TimeSegment value={pad(m)} label="m" baseText={baseText} subText={subText} />
        <Separator />
        <TimeSegment value={pad(s)} label="s" baseText={baseText} subText={subText} />
      </div>
    </div>
  );
}

function TimeSegment({
  value,
  label,
  baseText,
  subText,
}: {
  value: string;
  label: string;
  baseText: string;
  subText: string;
}) {
  return (
    <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center">
      <div className={["font-mono tabular-nums font-semibold", "text-sm sm:text-base", baseText].join(" ")}>
        {value}
      </div>
      <div className={["text-[10px] sm:text-xs uppercase tracking-wide", subText].join(" ")}>{label}</div>
    </div>
  );
}

function Separator() {
  return (
    <div className="flex items-center justify-center px-1 sm:px-1.5">
      <span className="font-mono tabular-nums text-sm sm:text-base text-emerald-400">:</span>
    </div>
  );
}
