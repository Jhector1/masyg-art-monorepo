// src/components/editor/utils/deriveInitialStyle.ts
import type { StyleState } from "../types";

// ── helpers ───────────────────────────────────────────────────────────────────
type RGB = { r: number; g: number; b: number };
const toHex = ({ r, g, b }: RGB) =>
  `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;

const luminance = ({ r, g, b }: RGB) =>
  0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);

const sameColor = (a: RGB, b: RGB) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 6;

// Quantize to shrink color space for a quick histogram
const qKey = ({ r, g, b }: RGB) =>
  `${(r >> 3) << 3},${(g >> 3) << 3},${(b >> 3) << 3}`; // 5 bits/channel

function pickFromCounts(counts: Map<string, number>, exclude: Set<string> = new Set()) {
  const arr = [...counts.entries()].filter(([k]) => !exclude.has(k));
  arr.sort((a, b) => b[1] - a[1]);
  return arr;
}

function parseKey(key: string): RGB {
  const [r, g, b] = key.split(",").map(n => Number(n));
  return { r, g, b };
}

async function extractFromImageURL(objectURL: string): Promise<StyleState> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = objectURL;
  });

  const w = Math.max(40, Math.min(160, Math.floor(img.naturalWidth / 8)));
  const h = Math.max(40, Math.min(160, Math.floor(img.naturalHeight / 8)));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;

  const allCounts = new Map<string, number>();
  const edgeCounts = new Map<string, number>();

  const push = (m: Map<string, number>, k: string) =>
    m.set(k, (m.get(k) || 0) + 1);

  for (let y = 0; y < h; y++) {
    const isEdgeRow = y < 2 || y >= h - 2;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a < 200) continue; // ignore mostly transparent
      const rgb: RGB = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
      const key = qKey(rgb);
      push(allCounts, key);
      if (isEdgeRow || x < 2 || x >= w - 2) push(edgeCounts, key);
    }
  }

  // Background guess: most frequent on borders
  const bgKey = pickFromCounts(edgeCounts)[0]?.[0] ?? pickFromCounts(allCounts)[0]?.[0] ?? "255,255,255";
  const bg = parseKey(bgKey);

  // Fill guess: most frequent non-background
  const exclude = new Set<string>([bgKey]);
  const fills = pickFromCounts(allCounts, exclude);
  const fillKey = fills[0]?.[0] ?? bgKey;
  const fill = parseKey(fillKey);

  // Stroke guess: darkest frequent non-background/non-fill
  exclude.add(fillKey);
  const rest = pickFromCounts(allCounts, exclude).slice(0, 10).map(([k]) => parseKey(k));
  let stroke = rest.reduce((darkest, c) => (luminance(c) < luminance(darkest) ? c : darkest), fill);
  if (sameColor(stroke, bg)) stroke = fill;

  return {
    fillColor: toHex(fill),
    strokeColor: toHex(stroke),
    strokeWidth: 2,             // numeric default is fine
    backgroundColor: toHex(bg),
  };
}

// Try server-provided defaults first; fall back to image analysis
export async function deriveInitialStyle(productId: string): Promise<StyleState> {
  // 1) Ask server (if you add such an endpoint)
  try {
    const r = await fetch(`/api/products/${productId}/default-style`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (j?.style?.fillColor && j?.style?.strokeColor) {
        return {
          strokeWidth: 2,
          backgroundColor: "#ffffff",
          ...j.style,
        } as StyleState;
      }
    }
  } catch {}

  // 2) Fallback to the current live preview
  const res = await fetch(`/api/products/${productId}/live-preview`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load preview for style derivation");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    return await extractFromImageURL(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
