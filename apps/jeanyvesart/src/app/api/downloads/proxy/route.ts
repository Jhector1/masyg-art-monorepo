// File: src/app/api/downloads/proxy/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeFilename(name: string) {
  return (name.replace(/[^\w.-]+/g, "_").slice(0, 120) || "download.bin");
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const urlParam = sp.get("url");
  const fileParam = sp.get("filename") || "download.bin";

  if (!urlParam) return new Response("Missing url", { status: 400 });

  // ✅ searchParams.get() is already decoded; no need to decode again.
  // Resolve relative URLs ("/api/...") against the current origin.
  let target: URL;
  try {
    target = new URL(urlParam, req.nextUrl.origin);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // (Optional) SSRF allowlist — always allow same-origin
  // const allowed = new Set<string>([new URL(req.nextUrl.origin).host, "res.cloudinary.com"]);
  // if (!allowed.has(target.host)) return new Response("Forbidden", { status: 403 });

  // Forward Range for resumable downloads
  const fwdHeaders: HeadersInit = {};
  const range = req.headers.get("range");
  if (range) (fwdHeaders as any).Range = range;

  const upstream = await fetch(target.toString(), {
    cache: "no-store",
    headers: fwdHeaders,
    // credentials: "include", // uncomment if your upstream needs cookies for same-origin calls
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream fetch failed (${upstream.status})`, { status: upstream.status });
  }

  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "no-store");

  // Ensure a sensible Content-Type
  if (!headers.get("Content-Type")) headers.set("Content-Type", "application/octet-stream");

  // Override filename if provided
  const filename = sanitizeFilename(fileParam);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  // Some servers don’t send Content-Length (chunked). Preserve if present.
  // If you want to guarantee it, you’d need to buffer — not recommended for large files.

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
