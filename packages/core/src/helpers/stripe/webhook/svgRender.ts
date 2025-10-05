// svgRender.ts
import * as cheerio from "cheerio";
import sharp from "sharp";
import { sanitizeSvg, sanitizeDefs } from "../../../lib/sanitizeSvg";

export type RasterFormat = "png" | "jpg" | "webp" | "tiff";

export interface StylePayload {
  fillColor: string;
  fillOpacity?: number;   // 0..1
  strokeColor: string;
  strokeOpacity?: number; // 0..1
  strokeWidth: number;
  backgroundColor: string;      // "none" for transparent
  backgroundOpacity?: number;   // 0..1
  includeWatermark?: boolean;   // default true
  defs?: string;                // sanitized & merged into <defs>
}

const MAX_SIDE   = 10_000;          // px
const MAX_PIXELS = 64 * 1024 * 1024; // 64MP

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Apply paints/opacity, inject sanitized <defs>, and manage a background rect.
 * Returns a complete XML string (with xml header) ready for rasterization.
 */
export function applyStyles(svg: string, payload: StylePayload): string {
  const clean = sanitizeSvg(svg);
  const $ = cheerio.load(clean, { xmlMode: true });

  const $svg = $("svg").first();
  if (!$svg.attr("xmlns")) $svg.attr("xmlns", "http://www.w3.org/2000/svg");
  if (!$svg.attr("xmlns:xlink")) $svg.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // ---- <defs> merge (sanitized) ----
  if (payload.defs && payload.defs.trim()) {
    const defsClean = sanitizeDefs(payload.defs);
    let $defs = $("svg > defs").first();
    if (!$defs.length) {
      $svg.prepend("<defs/>");
      $defs = $("svg > defs").first();
    }
    const frag = cheerio.load(defsClean, { xmlMode: true });
    // Allow either a full <defs> or raw children
    const nodes = frag("defs").length ? frag("defs").children() : frag.root().children();
    $defs.append(nodes);
  }

  // ---- Background rect (transparent if backgroundColor === "none" or opacity <= 0) ----
  const wantsTransparentBg =
    payload.backgroundColor === "none" ||
    (payload.backgroundOpacity != null && payload.backgroundOpacity <= 0);

  const $bg = $('svg [data-bg="true"]').first();
  if (wantsTransparentBg) {
    if ($bg.length) $bg.remove();
  } else {
    const attrs: Record<string, string> = {
      "data-bg": "true",
      x: "0",
      y: "0",
      width: "100%",
      height: "100%",
      fill: payload.backgroundColor,
    };
    if (payload.backgroundOpacity != null) {
      attrs["fill-opacity"] = String(clamp01(payload.backgroundOpacity));
    }
    if ($bg.length) {
      Object.entries(attrs).forEach(([k, v]) => $bg.attr(k, v));
      if (payload.backgroundOpacity == null) $bg.removeAttr("fill-opacity");
    } else {
      const rect = `<rect ${Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ")} />`;
      // Keep bg below actual art but above defs
      const $defsNow = $("svg > defs").first();
      if ($defsNow.length) $defsNow.after(rect);
      else $svg.prepend(rect);
    }
  }

  // ---- Paint + per-paint opacity on shapes (skip bg rect) ----
  $("path, circle, ellipse, polygon, polyline, line, rect:not([data-bg])").each((_, el) => {
    const $el = $(el);
    $el.attr("fill", payload.fillColor);
    $el.attr("stroke", payload.strokeColor);
    $el.attr("stroke-width", String(payload.strokeWidth));

    if (payload.fillOpacity != null) $el.attr("fill-opacity", String(clamp01(payload.fillOpacity)));
    else $el.removeAttr("fill-opacity");

    if (payload.strokeOpacity != null) $el.attr("stroke-opacity", String(clamp01(payload.strokeOpacity)));
    else $el.removeAttr("stroke-opacity");
  });

  // ---- Watermark (very light) ----
  if (payload.includeWatermark !== false) {
    $svg.append(
      `<text x="50%" y="97%" text-anchor="middle" fill="#000000" fill-opacity="0.05" font-size="36" font-family="sans-serif" pointer-events="none">© ZileDigital</text>`
    );
  }

  const xml = $.xml().trim();
  const header = xml.startsWith("<?xml") ? "" : `<?xml version="1.0" encoding="UTF-8"?>\n`;
  return header + xml;
}

/**
 * Inspect the SVG’s viewBox/width/height and return a clamped raster target size.
 * Supports absolute width/height, scale, or print dimensions with DPI in in/mm.
 */
export function resolveTargetSize(
  styledSvg: string,
  opts: {
    width?: number;
    height?: number;
    scale?: number;
    print?: { unit: "in" | "mm"; width: number; height: number; dpi: number };
  }
): { width: number; height: number } {
  const base = getBaseSizeFromSvg(styledSvg);

  // explicit px width/height
  if (opts.width || opts.height) {
    const width = opts.width ? Math.max(1, Math.floor(opts.width)) : base.w;
    const height = opts.height ? Math.max(1, Math.floor(opts.height)) : base.h;
    return clampToBounds(width, height);
  }

  // print dimensions
  if (opts.print) {
    const toIn = (v: number) => (opts.print!.unit === "mm" ? v / 25.4 : v);
    const wPx = Math.round(toIn(opts.print.width) * opts.print.dpi);
    const hPx = Math.round(toIn(opts.print.height) * opts.print.dpi);
    return clampToBounds(wPx, hPx);
  }

  // scale factor
  if (opts.scale && opts.scale > 0) {
    const wPx = Math.round(base.w * opts.scale);
    const hPx = Math.round(base.h * opts.scale);
    return clampToBounds(wPx, hPx);
  }

  // default = intrinsic
  return clampToBounds(base.w, base.h);
}

/**
 * Rasterize a styled SVG into the requested format using Sharp.
 * `canvasBg` fills the transparent canvas when needed (e.g., JPG).
 */
export async function rasterize(
  styledSvg: string,
  fmt: RasterFormat,
  size?: { width?: number; height?: number },
  canvasBg?: string
): Promise<Buffer> {
  let img = sharp(Buffer.from(styledSvg, "utf8"), { density: 300 });

  const isSolidBg = !!canvasBg && !/^url\(/.test(canvasBg);
  if (size?.width || size?.height) {
    img = img.resize(size.width, size.height, {
      fit: "contain",
      position: "centre", // sharp supports "centre"
      background: isSolidBg ? canvasBg! : "#0000",
    });
  }

  if (fmt === "jpg") {
    // JPEG has no alpha; flatten on white (or provided bg)
    img = img.flatten({ background: isSolidBg ? canvasBg! : "#ffffff" });
    return await img.jpeg({ quality: 90 }).toBuffer();
  }
  if (fmt === "png")  return await img.png({ quality: 90 }).toBuffer();
  if (fmt === "webp") return await img.webp({ quality: 90 }).toBuffer();
  return await img.tiff({ compression: "lzw" }).toBuffer();
}

/* -------------------- helpers -------------------- */

function getBaseSizeFromSvg(styledSvg: string): { w: number; h: number } {
  const $ = cheerio.load(styledSvg, { xmlMode: true });
  const $svg = $("svg").first();

  const vb = $svg.attr("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[ ,]+/).map(Number);
    if (parts.length === 4) {
      const [, , w, h] = parts;
      if (w > 0 && h > 0) return { w: Math.round(w), h: Math.round(h) };
    }
  }

  const num = (s?: string) => (s ? Math.max(1, Math.round(parseFloat(s))) : undefined);
  const w = num($svg.attr("width"));
  const h = num($svg.attr("height"));
  if (w && h) return { w, h };

  // fallback
  return { w: 1024, h: 1024 };
}

function clampToBounds(w: number, h: number): { width: number; height: number } {
  let W = Math.min(w, MAX_SIDE);
  let H = Math.min(h, MAX_SIDE);

  // keep under MAX_PIXELS
  if (W * H > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / (W * H));
    W = Math.max(1, Math.floor(W * scale));
    H = Math.max(1, Math.floor(H * scale));
  }
  return { width: W, height: H };
}
