// ───────────────────────────────────────────────────────────
// file: src/components/editor/utils/svg.ts
// ───────────────────────────────────────────────────────────
import type { GradientDef } from "../types";

export const angleToVec = (angle = 0) => {
  const a = ((((angle % 360) + 360) % 360) * Math.PI) / 180;
  const x = Math.cos(a), y = Math.sin(a);
  const x1 = (0.5 - x / 2) * 100;
  const y1 = (0.5 - y / 2) * 100;
  const x2 = (0.5 + x / 2) * 100;
  const y2 = (0.5 + y / 2) * 100;
  return { x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%` };
};

export function buildLinearGradientDef(g: GradientDef) {
  const { x1, y1, x2, y2 } = angleToVec(g.angle ?? 0);
  if ("stops" in g) {
    const stopsMarkup = g.stops
      .map(
        (s) =>
          `<stop offset="${(s.offset * 100).toFixed(1)}%" stop-color="${
            s.color
          }"${s.opacity != null ? ` stop-opacity="${s.opacity}"` : ""}/>`
      )
      .join("\n");
    return `<linearGradient id="${g.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsMarkup}</linearGradient>`.trim();
  }
  return `<linearGradient id="${g.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${g.from}"/><stop offset="100%" stop-color="${g.to}"/></linearGradient>`.trim();
}

export const gradientPreview = (g: GradientDef) => {
  if ("stops" in g) {
    const def = buildLinearGradientDef(g);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><defs>${def}</defs><rect width="48" height="32" fill="url(#${g.id})"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }
  return `linear-gradient(${g.angle ?? 0}deg, ${g.from}, ${g.to})`;
};

// src/components/studio/utils/svg.ts
// src/components/studio/utils/svg.ts
// (accept quoted url('#id') and normalize; keep external url(...) blocked)
// Accept quoted url('#id') and normalize; keep external url(...) blocked
export const safeColorValue = (v?: string | null): string | undefined => {
  if (!v) return undefined;
  const s = v.trim();

  // accept url('#id') / url("#id") / url(#id) → normalize to url(#id)
  const m = s.match(/^url\(\s*(['"]?)#([-\w:.]+)\1\s*\)$/i);
  if (m) return `url(#${m[2]})`;

  // drop external url(..)
  if (/^url\(/i.test(s)) return undefined;

  if (/^(none|transparent|currentColor)$/i.test(s)) return s;
  if (/^#([0-9a-f]{3,8})$/i.test(s)) return s;
  if (/^rgba?\([^)]+\)$/i.test(s)) return s;
  if (/^hsla?\([^)]+\)$/i.test(s)) return s;

  return undefined;
};

