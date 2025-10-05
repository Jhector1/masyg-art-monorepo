import { Prisma } from "@prisma/client";
export const RATE_PER_SQIN = 0.15;

/* ---------------- existing json utils (unchanged) ---------------- */
export const toJsonInput = (
  v: Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull =>
  v == null ? Prisma.JsonNull : (v as Prisma.InputJsonValue);

export const toNullableJson = (
  v: Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | null =>
  v == null ? null : (v as Prisma.InputJsonValue);

/* ---------------- robust WxH parser (unchanged API) ---------------- */
// replace your existing parseWh with this
// drop-in replacement
const parseWh = (s: string): [number, number] | null => {
  if (!s) return null;

  // normalize weird stuff
  const normalized = s
    .normalize("NFKC")
    // quotes & double prime → "
    .replace(/[“”„‟″ʺ˝❞❝〞〝]/g, '"')
    // single quotes & prime → '
    .replace(/[’‘‚‛′ʹ`]/g, "'")
    // multiply signs → x (add a few more variants)
    .replace(/[×✕✖⨉⨯⤫✖️]/g, "x")
    // remove zero-width chars
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // collapse ALL unicode spaces to a single normal space
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // 1) strict pattern: WxH with optional inch tokens
  let m =
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*x\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?/
    );

  // 2) fallback: any two numbers separated by non-number stuff
  if (!m) {
    m = normalized.match(/(\d+(?:\.\d+)?)[^\d.]+(\d+(?:\.\d+)?)/);
  }

  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return Number.isFinite(w) && Number.isFinite(h) ? [w, h] : null;
};


/* ---------------- small helpers (names kept) ---------------- */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Keep step-based rounding for UI multipliers (same name/signature). */
export const roundTo = (v: number, step = 0.05) => {
  const dec = Math.max(0, (step.toString().split(".")[1] || "").length);
  const k = Math.round(v / step + Number.EPSILON);
  const res = k * step;
  return parseFloat(res.toFixed(dec));
};

/* ---------------- options/type kept for compatibility ---------------- */
export type SizeMathOptions = {
  method?: "area" | "perimeter" | "max-dim"; // kept but ignored (we use area only)
  exponent?: number;     // kept, ignored
  minMult?: number;      // optional floor clamp for multiplier
  maxMult?: number;      // optional ceil clamp for multiplier
  step?: number;         // rounding step for multiplier (kept)
  knee?: number;         // kept, ignored
  slope?: number;        // kept, ignored
  /** choose baseline for ratios.
   *  - "min"   : smallest in the list (DEFAULT)
   *  - "first" : first entry in the list
   *  - "8x10"  : or any WxH string to anchor all sizes
   */
  baseline?: "min" | "first" | string;
};

/* ---------------- defaults (baseline now MIN to stop 'first item huge') ---------------- */
const STEP = 0.05 as const;
const BASELINE_DEFAULT: "min" = "min";

/* ---------------- NEW helpers (added; won't break existing code) ---------------- */
export const areaInSqIn = (size: string | null | undefined): number => {
  const p = size ? parseWh(size) : null;
  return p ? p[0] * p[1] : 0;
};

/** Simple, deterministic: base + area*rate (USD), rounded to cents. */
export const priceForSize = (
  basePrice: number,
  ratePerSqIn: number,
  size: string | null | undefined
): number => {
  const area = areaInSqIn(size);
  const raw = basePrice + area * ratePerSqIn;
  const cents = Math.round((raw + Number.EPSILON) * 100);
  return cents / 100;
};

/* ---------------- SIMPLE linear multipliers by AREA (structure preserved) ---------------- */
/**
 * cleanSizes: returns multipliers relative to a baseline area.
 * Baseline default is "min" (smallest area) to avoid first-item skew.
 */
export const cleanSizes = (
  sizes: string[] | undefined,
  opts?: SizeMathOptions
) => {
  if (!sizes?.length) return [];

  const step = opts?.step ?? STEP;

  // parse once
  const dims = sizes.map(parseWh);
  const areas = dims.map((p) => (p ? p[0] * p[1] : 0));

  // choose baseline area
  const baseline = opts?.baseline ?? BASELINE_DEFAULT;
  let baseArea: number | null = null;

  if (baseline === "first") {
    baseArea = areas[0] || 0;
  } else if (baseline === "min") {
    baseArea = Math.min(...areas.filter((a) => a > 0));
  } else if (typeof baseline === "string") {
    const p = parseWh(baseline);
    if (p) baseArea = p[0] * p[1];
  }
  if (!baseArea || !isFinite(baseArea) || baseArea <= 0) {
    baseArea = Math.min(...areas.filter((a) => a > 0)) || 1; // safe fallback
  }

  const minMult = opts?.minMult ?? 0;          // default no floor
  const maxMult = opts?.maxMult ?? Infinity;   // default no cap

  return sizes.map((label, i) => {
    const a = areas[i] > 0 ? areas[i] : baseArea!;
    const raw = a / baseArea!;
    const bounded = clamp(raw, minMult, maxMult);
    return { label, multiplier: roundTo(bounded, step) };
  });
};

/**
 * getSizeMultiplier: same signature; linear area ratio against the same baseline rule.
 * If the size is present in the provided list, we use the table for exact parity.
 */
export const getSizeMultiplier = (
  size: string | null | undefined,
  allSizes: string[] | undefined,
  opts?: Parameters<typeof cleanSizes>[1]
): number => {
  if (!size) return 1;

  const baseline = opts?.baseline ?? BASELINE_DEFAULT;
  const table = cleanSizes(allSizes, { ...opts, baseline });

  const hit = table.find(
    (x) => x.label.trim().toLowerCase() === size.trim().toLowerCase()
  );
  if (hit) return hit.multiplier;

  // fallback compute using same baseline rule
  if (!allSizes?.length) return 1;

  let baseArea: number | null = null;
  if (baseline === "first") {
    const p0 = parseWh(allSizes[0]);
    baseArea = p0 ? p0[0] * p0[1] : null;
  } else if (baseline === "min") {
    baseArea = Math.min(...allSizes.map(areaInSqIn).filter((x) => x > 0));
  } else if (typeof baseline === "string") {
    const p = parseWh(baseline);
    baseArea = p ? p[0] * p[1] : null;
  }
  if (!baseArea || baseArea <= 0 || !isFinite(baseArea)) {
    baseArea = Math.min(...allSizes.map(areaInSqIn).filter((x) => x > 0)) || 1;
  }

  const step = opts?.step ?? STEP;
  const minMult = opts?.minMult ?? 0;
  const maxMult = opts?.maxMult ?? Infinity;

  const a = areaInSqIn(size);
  const raw = a > 0 ? a / baseArea : 1;
  const bounded = clamp(raw, minMult, maxMult);
  return roundTo(bounded, step);
};

/* ---------------- unchanged date util ---------------- */
export const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  return typeof v === "string" ? new Date(v) : v;
};







// Accepts: 10x12, 10 x 12, 10" x 12", 10 in x 12 in, 10.5×12.25
export const SIZE_PATTERN = String.raw`^\s*\d+(\.\d+)?\s*(?:"|in(?:ches)?)?\s*[x×]\s*\d+(\.\d+)?\s*(?:"|in(?:ches)?)?\s*$`;
export const SIZE_RE = new RegExp(SIZE_PATTERN, "i");

export function formatSizeLive(input: string): string {
  // "credit-card style" gentle formatting while typing (1 'x' max, allow ×)
  let v = input.replace(/[×]/g, "x");
  // Keep only digits, dot, x, quotes, letters of "in"/"inches", and spaces
  v = v.replace(/[^0-9.x"inches\s]/gi, "");

  // Enforce a single 'x'
  const firstX = v.indexOf("x");
  if (firstX !== -1) {
    const before = v.slice(0, firstX).replace(/x/gi, "");
    const after = v.slice(firstX + 1).replace(/x/gi, "");
    v = `${before}x${after}`;
  }

  // Collapse spaces
  v = v.replace(/\s+/g, " ");

  // If user typed two numbers separated by any space, gently insert ` x `
  if (!/x/i.test(v)) {
    const m = v.match(/^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (m) v = `${m[1]} x ${m[2]}`;
  }

  return v;
}

export function normalizeSizeOnBlur(input: string): string {
  const raw = input.replace(/[×]/g, "x").replace(/\s+/g, " ").trim();
  const m = raw.match(
    /^\s*(\d+(?:\.\d+)?)(?:\s*(?:"|in(?:ches)?))?\s*[x]\s*(\d+(?:\.\d+)?)(?:\s*(?:"|in(?:ches)?))?\s*$/i
  );
  if (!m) return raw; // don't force if not valid; the border/message will show why
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  // Canonical output: 10" x 12"
  return `${w}" x ${h}"`;
}