"use client";

import React from "react";
import { useDesignContext } from "../contexts/DesignContext";
import type { StyleState } from "../types";
// If your constants live at src/components/editor/constants.ts:
import { GRADIENTS, PATTERNS, SOLIDS } from "../utils/constants";
// If they’re under utils/constants, use this instead:
// import { GRADIENTS, PATTERNS, SOLIDS } from "../utils/constants";

import { buildLinearGradientDef, gradientPreview } from "../utils/svg";

// Normalize color strings and url(...) paints so comparisons are stable
function normalizePaint(v: string): string {
  if (!v) return "";
  const m = v.match(/^url\((['"]?)#([^'")]+)\1\)$/i);
  if (m) return `url(#${m[2]})`;
  if (v.startsWith("#")) return v.toLowerCase();
  const el = document.createElement("div");
  el.style.color = v;
  document.body.appendChild(el);
  const out = getComputedStyle(el).color.toLowerCase();
  document.body.removeChild(el);
  return out;
}

const TARGETS = ["fill", "stroke", "background"] as const;
type Target = typeof TARGETS[number];

const MAX_VISIBLE = 24;

export default function Palette() {
  const {
    style,
    defsMap,
    setDefsMap, // ← use raw setter (no auto-commit)
    handleStyleChange,
    beginHistory,
    commitHistory,
  } = useDesignContext();

  const [target, setTarget] = React.useState<Target>("fill");

  const activeKey: keyof StyleState =
    target === "background"
      ? "backgroundColor"
      : target === "fill"
      ? "fillColor"
      : "strokeColor";

  const activeValue = (style?.[activeKey] as string) ?? "";

  // Local mirror for instant visual feedback; syncs to context changes
  const [selected, setSelected] = React.useState(activeValue);
  React.useEffect(() => setSelected(activeValue), [activeValue]);

  const pick = (val: string) => {
    setSelected(val); // immediate UI
    handleStyleChange(activeKey, val);
  };

  // Show-more toggles per section
  const [showAllSolids, setShowAllSolids] = React.useState(false);
  const [showAllGradients, setShowAllGradients] = React.useState(false);
  const [showAllPatterns, setShowAllPatterns] = React.useState(false);

  const solidsToRender = showAllSolids ? SOLIDS : SOLIDS.slice(0, MAX_VISIBLE);
  const gradientsToRender = showAllGradients
    ? GRADIENTS
    : GRADIENTS.slice(0, MAX_VISIBLE);
  const patternsToRender = showAllPatterns
    ? PATTERNS
    : PATTERNS.slice(0, MAX_VISIBLE);

  return (
    <div className="mb-4 rounded-2xl border border-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-black/70">Palette</h3>
        <div className="flex overflow-hidden rounded-xl ring-1 ring-black/10">
          {TARGETS.map((k) => {
            const isActive = target === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTarget(k)}
                className={[
                  "px-3 py-1 text-xs capitalize transition focus:outline-none",
                  isActive
                    ? "bg-emerald-100 text-emerald-900 ring-2 ring-emerald-600 ring-offset-2 ring-offset-white"
                    : "bg-white hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2",
                ].join(" ")}
                aria-pressed={isActive}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>

      {/* Solids */}
      <div className="mb-3">
        <div className="mb-1 text-xs text-black/50">Solids</div>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
          {solidsToRender.map((c) => {
            const isSelected = normalizePaint(selected) === normalizePaint(c);
            return (
              <button
                key={c}
                type="button"
                className={[
                  "h-8 w-8 sm:h-7 sm:w-7 rounded-lg ring-1 ring-black/10 transition",
                  "hover:ring-emerald-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2",
                  isSelected
                    ? "ring-2 ring-emerald-600 ring-offset-2 ring-offset-white"
                    : "",
                ].join(" ")}
                style={{ background: c }}
                title={c}
                aria-pressed={isSelected}
                onClick={() => {
                  beginHistory("Pick solid");
                  pick(c);
                  commitHistory("Pick solid");
                }}
              >
                <span className="sr-only">{c}</span>
              </button>
            );
          })}
        </div>
        {SOLIDS.length > MAX_VISIBLE && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowAllSolids((v) => !v)}
              className="text-xs underline underline-offset-2 text-emerald-700 hover:text-emerald-900"
              aria-expanded={showAllSolids}
            >
              {showAllSolids
                ? "Show less"
                : `Show ${SOLIDS.length - MAX_VISIBLE} more`}
            </button>
          </div>
        )}
      </div>

      {/* Gradients */}
      <div className="mb-3">
        <div className="mb-1 text-xs text-black/50">Gradients</div>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {gradientsToRender.map((g) => {
            const val = `url(#${g.id})`;
            const isSelected = normalizePaint(selected) === normalizePaint(val);
            return (
              <button
                key={g.id}
                type="button"
                className={[
                  "h-8 w-12 rounded-lg ring-1 ring-black/10 bg-white transition",
                  "hover:ring-emerald-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2",
                  isSelected
                    ? "ring-2 ring-emerald-600 ring-offset-2 ring-offset-white"
                    : "",
                ].join(" ")}
                style={{
                  backgroundImage: gradientPreview(g),
                  backgroundSize: "cover",
                }}
                title={g.id}
                aria-pressed={isSelected}
                onClick={() => {
                  beginHistory("Pick gradient");
                  setDefsMap({ ...defsMap, [g.id]: buildLinearGradientDef(g) });
                  pick(val);
                  commitHistory("Pick gradient");
                }}
              />
            );
          })}
        </div>
        {GRADIENTS.length > MAX_VISIBLE && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowAllGradients((v) => !v)}
              className="text-xs underline underline-offset-2 text-emerald-700 hover:text-emerald-900"
              aria-expanded={showAllGradients}
            >
              {showAllGradients
                ? "Show less"
                : `Show ${GRADIENTS.length - MAX_VISIBLE} more`}
            </button>
          </div>
        )}
      </div>

      {/* Patterns */}
      <div>
        <div className="mb-1 text-xs text-black/50">Patterns</div>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {patternsToRender.map((p) => {
            const val = `url(#${p.id})`;
            const isSelected = normalizePaint(selected) === normalizePaint(val);
            return (
              <button
                key={p.id}
                type="button"
                className={[
                  "h-8 w-12 rounded-lg ring-1 ring-black/10 bg-white transition",
                  "hover:ring-emerald-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2",
                  isSelected
                    ? "ring-2 ring-emerald-600 ring-offset-2 ring-offset-white"
                    : "",
                ].join(" ")}
                style={{
                  backgroundImage: `url("${p.preview}")`,
                  backgroundSize: "cover",
                }}
                title={p.id.replace("pat-", "")}
                aria-pressed={isSelected}
                onClick={() => {
                  beginHistory("Pick pattern");
                  setDefsMap({ ...defsMap, [p.id]: p.svg });
                  pick(val);
                  commitHistory("Pick pattern");
                }}
              />
            );
          })}
        </div>
        {PATTERNS.length > MAX_VISIBLE && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowAllPatterns((v) => !v)}
              className="text-xs underline underline-offset-2 text-emerald-700 hover:text-emerald-900"
              aria-expanded={showAllPatterns}
            >
              {showAllPatterns
                ? "Show less"
                : `Show ${PATTERNS.length - MAX_VISIBLE} more`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
