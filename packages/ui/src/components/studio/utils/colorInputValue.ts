// src/components/editor/utils/colorInputValue.ts

/** Return a safe #rrggbb for <input type="color"> */
export function colorInputValue(
  value: string | null | undefined,
  fallback = "#000000"
): string {
  const v = (value ?? "").trim().toLowerCase();

  if (!v || v === "none" || v === "transparent" || v.startsWith("url(")) {
    return normalizeHex(fallback);
  }

  // Hex forms: #rgb, #rrggbb, #rrggbbaa
  const hex = tryParseHex(v);
  if (hex) return hex;

  // rgb/rgba(...)
  const rgb = tryParseRgb(v);
  if (rgb) return rgbToHex(rgb[0], rgb[1], rgb[2]);

  // hsl/hsla(...)
  const hsl = tryParseHsl(v);
  if (hsl) {
    const [r, g, b] = hslToRgb(hsl[0], hsl[1], hsl[2]);
    return rgbToHex(r, g, b);
  }

  // Try resolving CSS named colors or odd formats via the browser
  const resolved = tryResolveCssColor(v);
  if (resolved) return rgbToHex(resolved[0], resolved[1], resolved[2]);

  // Give up: return normalized fallback
  return normalizeHex(fallback);
}

/* -------------------- helpers -------------------- */

function normalizeHex(input: string): string {
  const t = (input || "").trim().toLowerCase();
  const h = tryParseHex(t);
  return h ?? "#000000";
}

function tryParseHex(v: string): string | null {
  // #rgb
  const m3 = /^#([0-9a-f]{3})$/i.exec(v);
  if (m3) {
    const [r, g, b] = m3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  // #rrggbb
  const m6 = /^#([0-9a-f]{6})$/i.exec(v);
  if (m6) return `#${m6[1].toLowerCase()}`;
  // #rrggbbaa (ignore alpha)
  const m8 = /^#([0-9a-f]{8})$/i.exec(v);
  if (m8) return `#${m8[1].slice(0, 6).toLowerCase()}`;
  return null;
}

function tryParseRgb(v: string): [number, number, number] | null {
  // rgb(255, 0, 128) or rgba(255,0,128,0.5) or percentages
  const m = /^rgba?\(\s*([^\)]+)\s*\)$/i.exec(v);
  if (!m) return null;
  const parts = m[1].split(/\s*,\s*/);
  if (parts.length < 3) return null;

  const parseChan = (s: string) => {
    if (/%$/.test(s)) {
      const pct = clamp(parseFloat(s), 0, 100);
      return Math.round((pct / 100) * 255);
    }
    return clamp(Math.round(parseFloat(s)), 0, 255);
  };

  const r = parseChan(parts[0]);
  const g = parseChan(parts[1]);
  const b = parseChan(parts[2]);
  return [r, g, b];
}

function tryParseHsl(v: string): [number, number, number] | null {
  // hsl(210, 50%, 40%) or hsla(210,50%,40%,.5)
  const m = /^hsla?\(\s*([^\)]+)\s*\)$/i.exec(v);
  if (!m) return null;
  const parts = m[1].split(/\s*,\s*/);
  if (parts.length < 3) return null;

  const hRaw = parseFloat(parts[0]); // deg (can be any number)
  const sRaw = parseFloat(parts[1]);
  const lRaw = parseFloat(parts[2]);

  const h = ((hRaw % 360) + 360) % 360; // normalize to 0..359
  const s = clamp(sRaw, 0, 100) / 100;
  const l = clamp(lRaw, 0, 100) / 100;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (0 <= hp && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (1 <= hp && hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (2 <= hp && hp < 3) [r1, g1, b1] = [0, c, x];
  else if (3 <= hp && hp < 4) [r1, g1, b1] = [0, x, c];
  else if (4 <= hp && hp < 5) [r1, g1, b1] = [x, 0, c];
  else if (5 <= hp && hp < 6) [r1, g1, b1] = [c, 0, x];

  const m = l - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(n: number): string {
  const v = clamp(Math.round(n), 0, 255);
  return v.toString(16).padStart(2, "0");
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Resolve CSS names/odd formats using the browser (client only). */
let _resolverEl: HTMLSpanElement | null = null;
function tryResolveCssColor(v: string): [number, number, number] | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (!_resolverEl) {
    _resolverEl = document.createElement("span");
    _resolverEl.style.display = "none";
    document.body.appendChild(_resolverEl);
  }
  _resolverEl.style.color = "";
  _resolverEl.style.color = v;
  const cs = getComputedStyle(_resolverEl);
  const rgb = cs.color; // typically "rgb(r, g, b)" or "rgba(r, g, b, a)"
  return tryParseRgb(rgb);
}
