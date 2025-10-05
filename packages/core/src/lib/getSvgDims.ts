import { load, type CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import { readFile } from "fs/promises";
import path from "path";

/* -------------------- finalizer: namespaces + href/xlink + hoist defs -------------------- */
export function finalizeSvgNamespacesAndHrefs(svgString: string) {
  const $ = load(svgString, { xmlMode: true });
  const $root = $("svg").first();

  if (!$root.attr("xmlns")) $root.attr("xmlns", "http://www.w3.org/2000/svg");
  if (!$root.attr("xmlns:xlink")) $root.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

  $("linearGradient, radialGradient, pattern, use, image").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    const xhref = $el.attr("xlink:href");
    if (href && !xhref) $el.attr("xlink:href", href);
    if (!href && xhref) $el.attr("href", xhref);
  });

  const $defs = $root.children("defs");
  if ($defs.length) $root.prepend($defs);

  return $.xml();
}

/* -------------------- basic SVG dims from viewBox/width/height -------------------- */
function getBaseDims(svgString: string) {
  const $ = cheerio.load(svgString, { xmlMode: true });
  const $svg = $("svg").first();
  const vb = $svg.attr("viewBox");
  if (vb) {
    const [, , w, h] = vb.trim().split(/[ ,]+/).map(Number);
    if (w > 0 && h > 0) return { w, h };
  }
  const w = parseFloat($svg.attr("width") || "0");
  const h = parseFloat($svg.attr("height") || "0");
  return {
    w: Number.isFinite(w) && w > 0 ? w : 1024,
    h: Number.isFinite(h) && h > 0 ? h : 1024,
  };
}

/* -------------------- watermark loader (public file or URL) -------------------- */
const WATERMARK_SOURCE = process.env.WATERMARK_SVG_URL || "/watermark.svg";
let WM_CACHE:
  | { inner: string; defs: string; style: string; ww: number; hh: number }
  | null = null;
let WM_FETCHED_AT = 0;

async function readPublic(relPath: string) {
  const p = relPath.startsWith("/") ? relPath.slice(1) : relPath;
  const abs = path.join(process.cwd(), "public", p);
  return await readFile(abs, "utf8");
}

/* -------------------- prefix ids + classes and rewrite refs (incl. CSS) -------------------- */
function prefixIdsAndClasses($wm: CheerioAPI, idPrefix: string, classPrefix: string) {
  const idMap: Record<string, string> = {};
  const classMap: Record<string, string> = {};

  // ids
  $wm("[id]").each((_, el) => {
    const $el = $wm(el);
    const oldId = $el.attr("id");
    if (oldId) {
      const nu = `${idPrefix}${oldId}`;
      idMap[oldId] = nu;
      $el.attr("id", nu);
    }
  });

  // element class attr
  $wm("[class]").each((_, el) => {
    const $el = $wm(el);
    const classes = ($el.attr("class") || "").split(/\s+/).filter(Boolean);
    if (!classes.length) return;
    const n = classes.map((c) => {
      if (!classMap[c]) classMap[c] = `${classPrefix}${c}`;
      return classMap[c];
    });
    $el.attr("class", n.join(" "));
  });

  // attributes that can contain url(#id) or raw #id
  const ATTRS = [
    "fill", "stroke", "filter", "clip-path", "mask",
    "marker-start", "marker-mid", "marker-end",
    "href", "xlink:href", "style",
  ];

  const replaceIdRefs = (val: string) =>
    val
      .replace(/url\(#([^)]+)\)/g, (m, id) => (idMap[id] ? `url(#${idMap[id]})` : m))
      .replace(/(^|[^\w.-])#([A-Za-z_][\w.-]*)\b/g, (m, pre, id) =>
        idMap[id] ? `${pre}#${idMap[id]}` : m
      );

  $wm("*").each((_, el) => {
    const $el = $wm(el);
    for (const a of ATTRS) {
      const v = $el.attr(a);
      if (v) $el.attr(a, replaceIdRefs(v));
    }
  });

  // rewrite <style> content: .cls-1 → .wm-cls-1 and url(#old) → url(#new)
  $wm("style").each((_, el) => {
    const $el = $wm(el);
    let css = $el.text();
    for (const [oldC, nuC] of Object.entries(classMap)) {
      css = css.replace(new RegExp(`\\.${oldC}(?![\\w-])`, "g"), `.${nuC}`);
    }
    css = replaceIdRefs(css);
    $el.text(css);
  });
}

/* -------------------- fetch & prepare watermark (cached) -------------------- */
async function fetchWatermark() {
  if (WM_CACHE && Date.now() - WM_FETCHED_AT < 60 * 60 * 1000) return WM_CACHE;

  let raw: string;
  if (/^https?:\/\//i.test(WATERMARK_SOURCE)) {
    const res = await fetch(WATERMARK_SOURCE);
    if (!res.ok) throw new Error(`Fetch watermark failed: ${res.status}`);
    raw = await res.text();
  } else {
    raw = await readPublic(WATERMARK_SOURCE); // public/watermark.svg
  }

  // IMPORTANT: do NOT sanitize watermark; we need its <style> intact
  const $wm = load(raw, { xmlMode: true });
  const $svg = $wm("svg").first();

  const vb = ($svg.attr("viewBox") || "0 0 1000 1000").split(/[ ,]+/).map(Number);
  const ww = vb.length === 4 && vb[2] > 0 ? vb[2] : 1000;
  const hh = vb.length === 4 && vb[3] > 0 ? vb[3] : 1000;

  // avoid collisions
  prefixIdsAndClasses($wm, "wm-", "wm-");

  // gather defs & style
  let defs = "";
  $svg.children("defs").each((_, d) => {
    defs += $wm(d).html() || "";
  });

  let style = "";
  $svg.children("style").each((_, s) => {
    style += $wm(s).toString(); // keep <style> wrapper
  });

  const inner = $svg.html() || "";

  WM_CACHE = { inner, defs, style, ww, hh };
  WM_FETCHED_AT = Date.now();
  return WM_CACHE;
}

/* -------------------- public API: add full-width watermark -------------------- */
// add: fit = "width" | "stretch" | "cover"
//  - "width"   (default): your current behavior (scale to full width)
//  - "stretch": non-uniform scaleX/scaleY to fill both W & H exactly (no gaps)
//  - "cover":   uniform scale to cover the canvas (may overflow/crop)
export async function addStaticWatermarkFullWidth(
  baseSvg: string,
  opts: {
    position?: "top" | "center" | "bottom";
    margin?: number;
    opacity?: number;
    fit?: "width" | "stretch" | "cover";
  } = {}
) {
  const position = opts.position ?? "bottom";
  const margin = Math.max(0, opts.margin ?? 24);
  const opacity = Math.max(0, Math.min(1, opts.opacity ?? 0.12));
  const fit = opts.fit ?? "width";

  const { inner, defs, style, ww, hh } = await fetchWatermark(); // ww/hh = watermark's native size

  const $ = load(baseSvg, { xmlMode: true });
  const $svg = $("svg").first();

  // ensure <defs>, then merge watermark defs + style
  let $defs = $svg.children("defs").first();
  if (!$defs.length) {
    $svg.prepend("<defs/>");
    $defs = $svg.children("defs").first();
  }
  if (defs) $defs.append(defs);
  if (style) $defs.append(style);

  // base dims
  const { w: BW, h: BH } = getBaseDims($.xml());

  // remove any existing watermark layer to avoid stacking
  $svg.find('[data-watermark="true"]').remove();

  const availableW = Math.max(1, BW - 2 * margin);
  const availableH = Math.max(1, BH - 2 * margin);

  let x = margin;
  let y = margin;
  let transform = "";

  if (fit === "stretch") {
    // Non-uniform: fill entire canvas area exactly
    const sx = availableW / Math.max(1, ww);
    const sy = availableH / Math.max(1, hh);
    transform = `translate(${x} ${y}) scale(${sx} ${sy})`;
  } else if (fit === "cover") {
    // Uniform scale that *covers* both dimensions (may overflow & crop)
    const s = Math.max(availableW / Math.max(1, ww), availableH / Math.max(1, hh));
    const contentW = ww * s;
    const contentH = hh * s;
    // center inside the available box
    x = margin + (availableW - contentW) / 2;
    y = margin + (availableH - contentH) / 2;
    transform = `translate(${x} ${y}) scale(${s})`;
  } else {
    // "width" (original behavior): scale to full width; position by 'position'
    const s = availableW / Math.max(1, ww);
    x = margin;
    if (position === "center") y = margin + (availableH - hh * s) / 2;
    if (position === "bottom") y = margin + availableH - hh * s;
    transform = `translate(${x} ${y}) scale(${s})`;
  }

  $svg.append(`
    <g data-watermark="true"
       opacity="${opacity}"
       transform="${transform}"
       pointer-events="none">
      ${inner}
    </g>
  `);

  return $.xml();
}
