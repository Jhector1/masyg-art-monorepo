// ============================================================
// File: src/components/profile/Achievements.tsx
// Badge-based achievements with progress indicator (configurable)
// ============================================================
"use client";

import { TrophyIcon, LockClosedIcon } from "@heroicons/react/24/outline";

type Metric = "artworks" | "orders";

interface Achievement { label: string; threshold: number }
interface AchievementsProps {
  /** Recommended: pass unique artworks owned */
  uniqueArtworks?: number;
  /** Optional: total orders placed (for loyalty track) */
  ordersPlaced?: number;
  /** Which metric to show on this card (defaults to 'artworks') */
  metric?: Metric;
  /** Optional: override thresholds/labels per metric */
  overrides?: Partial<Record<Metric, Achievement[]>>;
}

/** Sensible defaults */
const DEFAULTS: Record<Metric, Achievement[]> = {
  artworks: [
    { label: "First Artwork", threshold: 1 },
    { label: "Rising Collector", threshold: 5 },
    { label: "Top Collector", threshold: 10 },
  ],
  orders: [
    { label: "First Purchase", threshold: 1 },
    { label: "Supporter of Haitian Artists", threshold: 10 },
    { label: "Top Patron", threshold: 20 },
  ],
};

export default function Achievements({
  uniqueArtworks = 0,
  ordersPlaced = 0,
  metric = "artworks",
  overrides,
}: AchievementsProps) {
  const ACHIEVEMENTS = overrides?.[metric] ?? DEFAULTS[metric];

  // pick value based on the chosen metric
  const value = metric === "artworks" ? uniqueArtworks : ordersPlaced;

  const max = ACHIEVEMENTS[ACHIEVEMENTS.length - 1].threshold;
  const next = ACHIEVEMENTS.find((a) => value < a.threshold);
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));

  const headerLabel = metric === "artworks" ? "Purchased Artworks" : "Orders";
  const youAreAwayFrom =
    metric === "artworks" ? "artworks away from" : "orders away from";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-gray-900">Achievements</h3>
        <span className="text-sm text-gray-600">
          {headerLabel}:{" "}
          <span className="font-semibold text-gray-900">{value}</span>
        </span>
      </div>

      <div className="bg-white/80 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-6">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>0</span>
            <span>{max}</span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-2 text-sm text-gray-600">
            {next ? (
              <>
                You&apos;re{" "}
                <span className="font-semibold text-gray-900">
                  {next.threshold - value}
                </span>{" "}
                {youAreAwayFrom} <span className="font-semibold">{next.label}</span>.
              </>
            ) : (
              <>
                <span className="font-semibold">All achievements unlocked!</span>{" "}
                Thank you for supporting Haitian artists.
              </>
            )}
          </p>
        </div>

        {/* Badges */}
        <ul className="mt-5 flex flex-wrap gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = value >= a.threshold;
            return (
              <li
                key={a.threshold}
                className={`px-3 py-2 rounded-full text-sm font-medium shadow-sm ring-1 transition ${
                  unlocked
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-gray-50 text-gray-400 ring-gray-200"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {unlocked ? (
                    <TrophyIcon className="h-4 w-4" />
                  ) : (
                    <LockClosedIcon className="h-4 w-4" />
                  )}
                  {a.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
