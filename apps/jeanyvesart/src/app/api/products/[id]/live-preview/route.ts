import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@acme/core/lib/prisma";
import { sanitizeDefs } from "@acme/core/lib/sanitizeSvg";
import {
  addStaticWatermarkFullWidth,
  finalizeSvgNamespacesAndHrefs,
} from "@acme/core/lib/getSvgDims";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Cheerio } from "cheerio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Only YOU upload product SVGs → treat base art as trusted */
const TRUSTED_SVG = true;

type StylePayload = {
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  defs?: string;
};

// ---------------- helpers ----------------
const isDefined = (v: any) =>
  v !== undefined && v !== null && String(v).trim() !== "";

// generic helper works for any selection of nodes
const setAttrIf = <T extends AnyNode>(
  $el: Cheerio<T>,
  name: string,
  val?: string | number
) => {
  if (val === undefined || val === null || val === "") {
    $el.removeAttr(name);
  } else {
    $el.attr(name, String(val));
  }
};

// keep internal gradients/patterns; block external url(...)
// accept url('#id') / url("#id") / url(#id) → normalize to url(#id)
const safeColor = (v?: string) => {
  if (v == null) return undefined;
  const s = String(v).trim();

  const m = s.match(/^url\(\s*(['"]?)#([-\w:.]+)\1\s*\)$/i);
  if (m) return `url(#${m[2]})`;

  if (/^url\(/i.test(s)) return undefined; // external url(...) -> drop
  // allow hex/rgb[a]/hsl[a]/named/none/currentColor/transparent...
  return s;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function parseInlineStyle(styleStr?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!styleStr) return out;
  for (const decl of styleStr.split(";")) {
    const i = decl.indexOf(":");
    if (i <= 0) continue;
    const k = decl.slice(0, i).trim().toLowerCase();
    const v = decl.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/** Render SVG → PNG as ArrayBuffer (sidestep Uint8Array generic typing) */
async function svgToPngArrayBuffer(svg: string): Promise<ArrayBuffer> {
  const header = svg.trim().startsWith("<?xml")
    ? ""
    : '<?xml version="1.0" encoding="UTF-8"?>\n';
  const svgString = header + svg;

  const buf = await sharp(Buffer.from(svgString, "utf8"), { density: 96 })
    .png({ quality: 80 })
    .toBuffer();

  // Convert Node Buffer view → real ArrayBuffer slice
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
}

function serializeInlineStyle(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k}:${v}`)
    .join("; ");
}

function upsertStyleProp<T extends AnyNode>(
  $el: cheerio.Cheerio<T>,
  prop: string,
  val?: string | number
) {
  const map = parseInlineStyle($el.attr("style"));
  if (isDefined(val)) map[prop] = String(val);
  else delete map[prop];
  const next = serializeInlineStyle(map);
  if (next) $el.attr("style", next);
  else $el.removeAttr("style");
}

async function loadSvgContent(svgOrUrl: string): Promise<string> {
  const t = svgOrUrl.trim();
  if (/^https?:\/\//i.test(t)) {
    const res = await fetch(t);
    if (!res.ok) throw new Error("Failed to fetch remote SVG");
    return await res.text();
  }
  return svgOrUrl;
}

/** Render SVG → PNG bytes (Uint8Array) to avoid Buffer typing issues */
// // async function svgToPngBytes(svg: string): Promise<Uint8Array> {
//   const header = svg.trim().startsWith("<?xml")
//     ? ""
//     : '<?xml version="1.0" encoding="UTF-8"?>\n';
//   const svgString = header + svg;
//   const buf = await sharp(Buffer.from(svgString, "utf8"), { density: 96 })
//     .png({ quality: 80 })
//     .toBuffer();
//   // Return a Uint8Array view over the same memory (no copy)
//   return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
// // }

const isInDefs = <T extends AnyNode>($el: Cheerio<T>) =>
  $el.parents("defs").length > 0;

// ---------------- GET: initial preview (no overrides) ----------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { svgFormat: true },
  });
  if (!product?.svgFormat)
    return NextResponse.json({ error: "SVG not found" }, { status: 404 });

  try {
    const raw = await loadSvgContent(product.svgFormat);
    const base = TRUSTED_SVG ? raw : raw;

    let withWm = base;
    try {
      withWm = await addStaticWatermarkFullWidth(base, {
        fit: "stretch",
        position: "bottom",
        // margin: 24,
        opacity: 0.12,
      });
    } catch {
      // watermark is best-effort; continue on failure
    }

    const finalSvg = finalizeSvgNamespacesAndHrefs(withWm);
    // const bytes = await svgToPngBytes(finalSvg);

    const ab = await svgToPngArrayBuffer(finalSvg);
    return new Response(ab, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("Conversion error (GET /live-preview):", e);
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}

// ---------------- POST: styled preview (apply only provided attrs) ----------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let payload = {} as StylePayload;
  try {
    payload = (await request.json()) as StylePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { svgFormat: true },
  });
  if (!product?.svgFormat)
    return NextResponse.json({ error: "SVG not found" }, { status: 404 });

  try {
    const raw = await loadSvgContent(product.svgFormat);
    const base = TRUSTED_SVG ? raw : raw;

    const $ = cheerio.load(base, { xmlMode: true });
    const $svg = $("svg").first();

    // namespaces
    if (!$svg.attr("xmlns")) $svg.attr("xmlns", "http://www.w3.org/2000/svg");
    if (!$svg.attr("xmlns:xlink"))
      $svg.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // optional <defs> injection from payload
    if (isDefined(payload.defs)) {
      let $defs = $("svg > defs").first();
      if (!$defs.length) {
        $svg.prepend("<defs/>");
        $defs = $("svg > defs").first();
      }
      const defsClean = sanitizeDefs(String(payload.defs));
      const frag = cheerio.load(defsClean, { xmlMode: true });
      $defs.append(
        frag("defs").length ? frag("defs").children() : frag.root().children()
      );
    }

    // Background rect
    const bgColor = safeColor(payload.backgroundColor);
    const wantsTransparentBg =
      String(payload.backgroundColor || "").trim() === "none" ||
      (payload.backgroundOpacity != null && payload.backgroundOpacity <= 0);

    const $bg = $('svg [data-bg="true"]').first();
    if (wantsTransparentBg || !isDefined(bgColor)) {
      if ($bg.length) $bg.remove();
    } else {
      const attrs: Record<string, string> = {
        "data-bg": "true",
        x: "0",
        y: "0",
        width: "100%",
        height: "100%",
        fill: bgColor!,
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
        const $defsNow = $("svg > defs").first();
        if ($defsNow.length) $defsNow.after(rect);
        else $svg.prepend(rect);
      }
    }

    // Fills/strokes (skip bg rect and anything in <defs>)
    $svg
      .find("path, circle, ellipse, polygon, polyline, line, rect")
      .each((_, el) => {
        const $el = $(el);

        // skip background rect
        if ($el.is('rect[data-bg="true"]')) return;

        // do not touch paint servers or their children
        if (isInDefs($el)) return;

        const fillVal = safeColor(payload.fillColor);
        const strokeVal = safeColor(payload.strokeColor);
        const strokeWidthVal =
          payload.strokeWidth !== undefined && payload.strokeWidth !== null
            ? String(payload.strokeWidth)
            : undefined;

        // attribute + inline style to beat existing CSS
        setAttrIf($el, "fill", fillVal);
        upsertStyleProp($el, "fill", fillVal);

        setAttrIf($el, "stroke", strokeVal);
        upsertStyleProp($el, "stroke", strokeVal);

        if (strokeWidthVal) {
          $el.attr("stroke-width", strokeWidthVal);
          upsertStyleProp($el, "stroke-width", strokeWidthVal);
        }

        if (payload.fillOpacity != null) {
          const v = String(Math.max(0, Math.min(1, payload.fillOpacity)));
          $el.attr("fill-opacity", v);
          upsertStyleProp($el, "fill-opacity", v);
        } else {
          $el.removeAttr("fill-opacity");
          upsertStyleProp($el, "fill-opacity", undefined);
        }

        if (payload.strokeOpacity != null) {
          const v = String(Math.max(0, Math.min(1, payload.strokeOpacity)));
          $el.attr("stroke-opacity", v);
          upsertStyleProp($el, "stroke-opacity", v);
        } else {
          $el.removeAttr("stroke-opacity");
          upsertStyleProp($el, "stroke-opacity", undefined);
        }
      });

    // watermark + finalize
    let finalSvg = $.xml();
    try {
      finalSvg = await addStaticWatermarkFullWidth(finalSvg, {
        fit: "stretch",
        position: "bottom",
        // margin: 24,
        opacity: 0.12,
      });
    } catch {
      // best-effort
    }
    finalSvg = finalizeSvgNamespacesAndHrefs(finalSvg);

    const ab = await svgToPngArrayBuffer(finalSvg);
    return new Response(ab, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("Conversion error (POST /live-preview):", e);
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}
