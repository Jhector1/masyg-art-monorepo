import Link from "next/link";
import { money, dateTime } from "@/lib/merchant-format";
import { storeQuery } from "@/lib/merchant-navigation";
export function RecordPill({ status }: { status: string }) {
  const ok = ["PAID", "FULFILLED", "SUCCEEDED", "DELIVERED"].includes(status);
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-800" : status === "FAILED" || status === "CANCELLED" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{status.replaceAll("_", " ")}</span>;
}
export { money, dateTime };
export function Pager({ base, storeId, page, pages, extra = "" }: { base: string; storeId: string; page: number; pages: number; extra?: string }) {
  const href = (p: number) => `${base}${storeQuery(storeId)}&page=${p}${extra}`;
  return <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4 text-sm">
    {page > 1 ? <Link className="rounded-xl border bg-white px-4 py-2" href={href(page-1)}>Previous</Link> : <span className="text-zinc-400">Previous</span>}
    <span className="text-zinc-600">Page {page} of {pages}</span>
    {page < pages ? <Link className="rounded-xl border bg-white px-4 py-2" href={href(page+1)}>Next</Link> : <span className="text-zinc-400">Next</span>}
  </nav>;
}
