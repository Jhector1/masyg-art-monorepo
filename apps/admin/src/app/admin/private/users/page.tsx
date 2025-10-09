// app/admin/private/users/page.tsx
import Link from "next/link";
import DataTable from "@/components/admin/DataTable";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = { q?: string | string[]; page?: string | string[]; pageSize?: string | string[] };

function get(sp: SP, key: keyof SP, fallback: string) {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SP>; // 👈 important: it's a Promise
}) {
      await requireAdmin();
    
  const sp = await searchParams;              // 👈 await once
  const q = get(sp, "q", "");
  const page = Number(get(sp, "page", "1"));
  const pageSize = Number(get(sp, "pageSize", "20"));

  const { listUsers } = await import("@/services/admin/users");
  const data = await listUsers({ q, page, pageSize });

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <form className="flex gap-2" action="/admin/private/users" method="GET">
          <input name="q" defaultValue={q} className="rounded-xl border px-3 py-2 text-sm" placeholder="Search email or name" />
          <button className="rounded-xl border px-3 py-2 text-sm hover:bg-muted" type="submit">Search</button>
        </form>
      </header>

      <DataTable
        rows={data.rows}
        cols={[
          { header: "Email", key: "email", render: (r: any) => <span className="font-medium">{r.email}</span> },
          { header: "Name", key: "name" },
          { header: "Orders", key: "_count", render: (r: any) => r._count.orders },
          { header: "Favorites", key: "_count", render: (r: any) => r._count.favorites },
          { header: "Reviews", key: "_count", render: (r: any) => r._count.reviews },
          { header: "Joined", key: "createdAt", render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {data.page} of {data.pages} • {data.total} users</div>
        <div className="flex gap-2">
          {data.page > 1 && (
            <Link className="rounded-xl border px-3 py-2 text-sm" href={`/admin/private/users?q=${encodeURIComponent(q)}&page=${data.page - 1}&pageSize=${pageSize}`}>Prev</Link>
          )}
          {data.page < data.pages && (
            <Link className="rounded-xl border px-3 py-2 text-sm" href={`/admin/private/users?q=${encodeURIComponent(q)}&page=${data.page + 1}&pageSize=${pageSize}`}>Next</Link>
          )}
        </div>
      </div>
    </main>
  );
}
