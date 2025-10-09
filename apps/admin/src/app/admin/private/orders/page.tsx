// app/admin/private/orders/page.tsx
import Link from "next/link";
import DataTable from "@/components/admin/DataTable";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = { q?: string | string[]; status?: string | string[]; page?: string | string[]; pageSize?: string | string[] };
const get = (sp: SP, k: keyof SP, d: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] ?? d : (sp[k] as string) ?? d);

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;  
  await requireAdmin();                   // ✅ await once
  const q = get(sp, "q", "");
  const status = get(sp, "status", "");
  const page = Number(get(sp, "page", "1"));
  const pageSize = Number(get(sp, "pageSize", "20"));

  const { listOrders } = await import("@/services/admin/orders");
  const data = await listOrders({ q, status: status || undefined, page, pageSize });

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <form className="flex gap-2" action="/admin/private/orders" method="GET">
          <input name="q" defaultValue={q} className="rounded-xl border px-3 py-2 text-sm" placeholder="Search id / email / session" />
          <input name="status" defaultValue={status} className="rounded-xl border px-3 py-2 text-sm w-36" placeholder="Status" />
          <button className="rounded-xl border px-3 py-2 text-sm hover:bg-muted" type="submit">Search</button>
        </form>
      </header>

      <DataTable
        rows={data.rows}
        cols={[
          { header: "Order", key: "id", render: (r: any) => <Link className="underline" href={`/admin/private/orders/${r.id}`}>{r.id.slice(0, 8)}…</Link> },
          { header: "Placed", key: "placedAt", render: (r: any) => new Date(r.placedAt).toLocaleString() },
          { header: "Buyer", key: "user", render: (r: any) => r.user?.email ?? "Guest" },
          { header: "Items", key: "_count", render: (r: any) => r._count.items },
          { header: "Total", key: "total", render: (r: any) => `$${Number(r.total).toFixed(2)}` },
          { header: "Status", key: "status" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {data.page} of {data.pages} • {data.total} orders</div>
        <div className="flex gap-2">
          {data.page > 1 && (
            <Link className="rounded-xl border px-3 py-2 text-sm" href={`/admin/private/orders?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${data.page - 1}&pageSize=${pageSize}`}>Prev</Link>
          )}
          {data.page < data.pages && (
            <Link className="rounded-xl border px-3 py-2 text-sm" href={`/admin/private/orders?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${data.page + 1}&pageSize=${pageSize}`}>Next</Link>
          )}
        </div>
      </div>
    </main>
  );
}
