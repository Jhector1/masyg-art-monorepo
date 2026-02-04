import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeFilename(name: string) {
  return (name.replace(/[^\w.-]+/g, "_").slice(0, 120) || "download.bin");
}

function isHttp(url: URL) {
  return url.protocol === "http:" || url.protocol === "https:";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const urlParam = sp.get("url");
  const fileParam = sp.get("filename") || "download.bin";
  if (!urlParam) return new Response("Missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(urlParam, req.nextUrl.origin);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (!isHttp(target)) return new Response("Invalid protocol", { status: 400 });

  const myHost = new URL(req.nextUrl.origin).host;
  const allowedHosts = new Set([myHost, "res.cloudinary.com", "api.cloudinary.com"]);
  if (!allowedHosts.has(target.host)) return new Response("Forbidden", { status: 403 });

  const sameOrigin = target.host === myHost;

  // Forward Range for resumable downloads
  const fwdHeaders: HeadersInit = {};
  const range = req.headers.get("range");
  if (range) (fwdHeaders as any).Range = range;

  // ✅ Only forward cookies to SAME-ORIGIN targets (never to Cloudinary)
  if (sameOrigin) {
    const cookie = req.headers.get("cookie");
    if (cookie) (fwdHeaders as any).Cookie = cookie;
  }

  const upstream = await fetch(target.toString(), {
    cache: "no-store",
    headers: fwdHeaders,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream fetch failed (${upstream.status})`, {
      status: upstream.status,
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "no-store");
  if (!headers.get("Content-Type")) headers.set("Content-Type", "application/octet-stream");

  const filename = sanitizeFilename(fileParam);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
