import { NextRequest } from "next/server";
import { authOptions as customerAuthOptions } from "@acme/auth";

export const authOptions = customerAuthOptions;

export async function requireAdmin(_req: NextRequest) {
  // Public storefront sessions are customer-only by design. Administrative
  // access belongs exclusively to apps/admin. Shared storefront admin routes
  // therefore fail closed instead of trusting any customer-session claim.
  const err = new Error("Forbidden");
  (err as any).status = 403;
  throw err;
}

export function parseList(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof input !== "string") return [];
  return input
    .split(/\r?\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listToTextarea(items?: string[]) {
  return (items ?? []).join("\n");
}

/** Convert Date to value for <input type="datetime-local"> (local, no 'Z') */
export function toDatetimeLocalValue(d?: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hh}:${mm}`;
}
