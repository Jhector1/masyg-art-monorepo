"use client";
import { useRouter } from "next/navigation";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { storeQuery } from "@/lib/merchant-navigation";
export { storeQuery, productHref } from "@/lib/merchant-navigation";

export const field = "mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-50";
export const primary = "inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40";
export const secondary = "inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40";
export const mutatable = (store: StoreChoice) => store.role === "OWNER" || store.role === "ADMIN";

export function StoreSelect({ stores, selected, pathname }: { stores: StoreChoice[]; selected: string; pathname: string }) {
  const router = useRouter();
  return <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">Storefront
    <select aria-label="Select storefront" value={selected} className={`${field} min-w-0 max-w-lg font-medium normal-case tracking-normal`} onChange={e => router.push(`${pathname}${storeQuery(e.target.value)}`)}>
      {stores.map(s => <option key={s.storeId} value={s.storeId}>{s.organizationName} / {s.storeName}</option>)}
    </select>
  </label>;
}
export function Status({ value }: { value: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${value === "PUBLISHED" ? "bg-emerald-50 text-emerald-800" : value === "ARCHIVED" ? "bg-zinc-100 text-zinc-600" : "bg-amber-50 text-amber-800"}`}>{value.toLowerCase()}</span>;
}
export async function callMerchant(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: object): Promise<unknown> {
  const res = await fetch(path, { method, credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : undefined;
    const issues = data && typeof data === "object" && "issues" in data && Array.isArray(data.issues) ? data.issues : [];
    const details = issues.slice(0, 8).flatMap((issue: unknown) => {
      if (!issue || typeof issue !== "object") return [];
      const item = issue as { path?: unknown; message?: unknown };
      if (typeof item.message !== "string") return [];
      const path = Array.isArray(item.path) ? item.path.filter(part => typeof part === "string" || typeof part === "number").join(" → ") : "";
      return [`${path ? `${path}: ` : ""}${item.message}`];
    });
    throw new Error(details.length ? details.join("\n") : typeof err === "string" ? err : `Request failed (${res.status})`);
  }
  return data;
}
export function toMinor(value: string): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;
  const [units, cents = ""] = value.split(".");
  const result = Number(units) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}
export function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63).replace(/-$/g, "");
}
export { money } from "@/lib/merchant-format";
export function attr(attributes: unknown, key: "size" | "material" | "format" | "edition" | "finish" | "license" | "frame" | "glazing") {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return "";
  const value = (attributes as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
