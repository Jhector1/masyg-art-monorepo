// File: src/lib/server/api.ts
import 'server-only';
import { headers, cookies } from "next/headers";

export async function serverFetchJSON<T>(
  path: string,
  init?: RequestInit,
  { forwardCookies = true }: { forwardCookies?: boolean } = {}
): Promise<T> {
  // Build base URL
  let base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!base) {
    const h = await headers(); // async in Next 15
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host  = h.get("host") ?? "localhost:3000";
    base = `${proto}://${host}`;
  }

  // Merge headers safely (handles Headers | Record | [][]
  const hdrs = new Headers(init?.headers ?? {});
  if (!hdrs.has("accept")) hdrs.set("accept", "application/json");

  if (forwardCookies) {
    const h = await headers();
    const fromHeader = h.get("cookie");
    if (fromHeader) {
      hdrs.set("cookie", fromHeader);
    } else {
      const c = await cookies();                // async in Next 15
      const serialized = c.toString();
      if (serialized) hdrs.set("cookie", serialized);
    }
  }

  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    ...init,
    headers: hdrs,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Fetch ${res.status}: ${msg || path}`);
  }
  return res.json() as Promise<T>;
}
