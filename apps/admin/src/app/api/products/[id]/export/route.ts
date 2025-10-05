// src/app/api/products/[id]/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { prisma } from "@acme/core/lib/prisma";
import { sanitizeDefs, sanitizeSvg } from "@acme/core/lib/sanitizeSvg";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import {
  getEntitlementSummary,
  getPurchasedFlag,
  consumeOneExportCredit,
} from "@acme/core/helpers/stripe/webhook/entitlements";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------- helpers ----------
async function loadSvgContent(svgOrUrl: string): Promise<string> {
  const trimmed = svgOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const res = await fetch(trimmed);
    if (!res.ok) throw new Error("Failed to fetch remote SVG");
    return await res.text();
  }
  return svgOrUrl;
}

function applyStyles(
  svg: string,
  payload: {
    fillColor: string;
    fillOpacity?: number;
    strokeColor: string;
    strokeOpacity?: number;
    strokeWidth: number;
    backgroundColor: string;
    backgroundOpacity?: number;
    includeWatermark?: boolean;
    defs?: string;
  }
) {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const clean = sanitizeSvg(svg);
  const $ = cheerio.load(clean, { xmlMode: true });

  const $svg = $("svg").first();
  if (!$svg.attr("xmlns")) $svg.attr("xmlns", "http://www.w3.org/2000/svg");
  if (!$svg.attr("xmlns:xlink")) $svg.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // Inject sanitized <defs>
  let $defs = $("svg > defs").first();
  if (payload.defs && payload.defs.trim()) {
    const defsClean = sanitizeDefs(payload.defs);
    if (!$defs.length) {
      $svg.prepend("<defs/>");
      $defs = $("svg > defs").first();
    }
    const defsFrag = cheerio.load(defsClean, { xmlMode: true });
    $defs.append(defsFrag("defs").length ? defsFrag("defs").children() : defsFrag.root().children());
  }

  // Background rect management
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
      $bg.attr(attrs);
      if (payload.backgroundOpacity == null) $bg.removeAttr("fill-opacity");
    } else {
      const rect = `<rect ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")} />`;
      const $defsNow = $("svg > defs").first();
      if ($defsNow.length) $defsNow.after(rect);
      else $svg.prepend(rect);
    }
  }

  // Apply paints + per-paint opacity (skip bg rect)
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

  if (payload.includeWatermark !== false) {
    $svg.append(
      `<text x="50%" y="97%" text-anchor="middle" fill="#000000" fill-opacity="0.05" font-size="36" font-family="sans-serif" pointer-events="none">© ZileDigital</text>`
    );
  }

  const xml = $.xml().trim();
  const header = xml.startsWith("<?xml") ? "" : `<?xml version="1.0" encoding="UTF-8"?>\n`;
  return header + xml;
}

function formatToMime(fmt: string): string {
  switch (fmt) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "tiff":
    case "tif": return "image/tiff";
    case "svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

async function rasterize(
  styledSvg: string,
  fmt: "png" | "jpg" | "webp" | "tiff",
  size?: { width?: number; height?: number },
  canvasBg?: string
) {
  let img = sharp(Buffer.from(styledSvg, "utf8"), { density: 300 });

  const isSolid = canvasBg && !/^url\(/.test(canvasBg);
  if (size?.width || size?.height) {
    img = img.resize(size.width, size.height, {
      fit: "contain",
      position: "centre",
      background: isSolid ? canvasBg! : "#0000",
    });
  }

  if (fmt === "jpg") {
    img = img.flatten({ background: isSolid ? canvasBg! : "#ffffff" });
    return await img.jpeg({ quality: 90 }).toBuffer();
  }
  if (fmt === "png")  return await img.png({ quality: 90 }).toBuffer();
  if (fmt === "webp") return await img.webp({ quality: 90 }).toBuffer();
  return await img.tiff({ compression: "lzw" }).toBuffer();
}

const MAX_SIDE = 10000;
const MAX_PIXELS = 64 * 1024 * 1024;

function getBaseSizeFromSvg(styledSvg: string) {
  const $ = cheerio.load(styledSvg, { xmlMode: true });
  const $svg = $("svg").first();
  const vb = $svg.attr("viewBox");
  if (vb) {
    const [, , w, h] = vb.trim().split(/[ ,]+/).map(Number);
    if (w > 0 && h > 0) return { w: Math.round(w), h: Math.round(h) };
  }
  const num = (s?: string) => (s ? Math.max(1, Math.round(parseFloat(s))) : undefined);
  const w = num($svg.attr("width"));
  const h = num($svg.attr("height"));
  if (w && h) return { w, h };
  return { w: 1024, h: 1024 };
}


function clampToBounds(w: number, h: number) {
  // Preserve aspect while clamping
  let W = w;
  let H = h;

  // 1) Cap by max side, proportionally
  if (W > MAX_SIDE || H > MAX_SIDE) {
    const s = Math.min(MAX_SIDE / W, MAX_SIDE / H);
    W = Math.max(1, Math.floor(W * s));
    H = Math.max(1, Math.floor(H * s));
  }

  // 2) Cap by total pixels, proportionally
  if (W * H > MAX_PIXELS) {
    const s = Math.sqrt(MAX_PIXELS / (W * H));
    W = Math.max(1, Math.floor(W * s));
    H = Math.max(1, Math.floor(H * s));
  }
  return { width: W, height: H };
}

function resolveTargetSize(
  styledSvg: string,
  opts: {
    width?: number;
    height?: number;
    scale?: number;
    print?: { unit: "in" | "mm"; width: number; height: number; dpi: number };
  }
) {
  const base = getBaseSizeFromSvg(styledSvg); // { w, h }
  const aspect = base.w / base.h;

  // Explicit width/height handling
  const hasW = typeof opts.width === "number" && opts.width > 0;
  const hasH = typeof opts.height === "number" && opts.height > 0;

  if (hasW && !hasH) {
    const W = Math.max(1, Math.floor(opts.width!));
    const H = Math.max(1, Math.round(W / aspect));
    return clampToBounds(W, H);
  }
  if (!hasW && hasH) {
    const H = Math.max(1, Math.floor(opts.height!));
    const W = Math.max(1, Math.round(H * aspect));
    return clampToBounds(W, H);
  }
  if (hasW && hasH) {
    const W = Math.max(1, Math.floor(opts.width!));
    const H = Math.max(1, Math.floor(opts.height!));
    return clampToBounds(W, H);
  }

  // Print target in px
  if (opts.print) {
    const toIn = (v: number) => (opts.print!.unit === "mm" ? v / 25.4 : v);
    const W = Math.round(toIn(opts.print.width) * opts.print.dpi);
    const H = Math.round(toIn(opts.print.height) * opts.print.dpi);
    return clampToBounds(W, H);
  }

  // Scale factor from base
  if (opts.scale && opts.scale > 0) {
    const W = Math.round(base.w * opts.scale);
    const H = Math.round(base.h * opts.scale);
    return clampToBounds(W, H);
  }

  // Default: base size clamped
  return clampToBounds(base.w, base.h);
}

// ---------- route ----------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

    // Require signed-in user (old behavior)
    const { userId } = await getCustomerIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Please sign in to export." }, { status: 401 });
    }

    // Parse body with safe defaults
    const body = await req.json().catch(() => ({} as any));
    const {
      style,
      format = "png",
      width,
      height,
      filename = `art-${productId}-${Date.now()}.${format}`,
      includeWatermark = true,
      scale,
      print,
    }: {
      style: {
        fillColor: string;
        fillOpacity?: number;
        strokeColor: string;
        strokeOpacity?: number;
        strokeWidth: number;
        backgroundColor: string;
        backgroundOpacity?: number;
        defs?: string;
      };
      format?: "png" | "jpg" | "jpeg" | "webp" | "tiff" | "svg";
      width?: number;
      height?: number;
      filename?: string;
      includeWatermark?: boolean;
      scale?: number;
      print?: { unit: "in" | "mm"; width: number; height: number; dpi: number };
    } = body;

    if (!style) {
      return NextResponse.json({ error: "Missing style" }, { status: 400 });
    }

    // Gate: must have purchased AND credits left
    const who = { userId, guestId: null };
    const purchased = await getPurchasedFlag(who, productId);
    if (!purchased) {
      return NextResponse.json({ error: "Purchase required to export." }, { status: 403 });
    }

    const summary = await getEntitlementSummary(who, productId);
    if (summary.exportsLeft <= 0) {
      return NextResponse.json({ error: "Export quota exhausted." }, { status: 403 });
    }

    // Load product SVG
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { svgFormat: true },
    });
    if (!product?.svgFormat) {
      return NextResponse.json({ error: "SVG not found" }, { status: 404 });
    }

    // Style it
    const raw = await loadSvgContent(product.svgFormat);
    const styled = applyStyles(raw, { ...style, includeWatermark });

    // Render (do heavy work before consuming credit; use idempotency for safety)
    let bodyBuf: Buffer | string;
    let contentType: string;

    const fmt = (format === "jpeg" ? "jpg" : format) as "png" | "jpg" | "webp" | "tiff" | "svg";

    if (fmt === "svg") {
      bodyBuf = styled;
      contentType = "image/svg+xml";
    } else {
      const { width: frameW, height: frameH } = resolveTargetSize(styled, { width, height, scale, print });

      const isSolidBg =
        style.backgroundColor &&
        style.backgroundColor !== "none" &&
        !/^url\(/.test(style.backgroundColor);

      const canvasBgForRaster = isSolidBg ? style.backgroundColor : undefined;
      bodyBuf = await rasterize(styled, fmt as Exclude<typeof fmt, "svg">, { width: frameW, height: frameH }, canvasBgForRaster);
      contentType = formatToMime(fmt);
    }

    // Atomically consume 1 credit (idempotent)
    const idempotencyKey = req.headers.get("x-idempotency-key") ?? `export:${userId}:${productId}:${randomUUID()}`;
    const consumed = await consumeOneExportCredit({
      who,
      productId,
      userDesignId: undefined,
      purchasedDesignId: undefined,
      idempotencyKey,
      meta: {
        format: fmt,
        width: typeof width === "number" ? width : null,
        height: typeof height === "number" ? height : null,
        extra: { scale: typeof scale === "number" ? scale : undefined, print: print ?? undefined },
      },
    });

    if (!consumed.ok && !("already" in consumed)) {
      // If idempotency said "already", let it pass; otherwise block
      return NextResponse.json({ error: "Export quota exhausted." }, { status: 403 });
    }

    // Return file
    return new NextResponse(bodyBuf as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("EXPORT_ERROR", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
