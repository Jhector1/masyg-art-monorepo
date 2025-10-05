import Link from "next/link";
// import { requireAdmin } from "@acme/core/lib/auth";
import { getAdminDashboard } from "../services/admin/dashboard";
// import { getAdminDashboard } from "@acme/server/services/admin/dashboard";

function StatCard({ title, value, href }: { title: string; value: number | string; href?: string }) {
  const body = (
    <div className="rounded-2xl border p-5 hover:shadow-sm transition">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminHomePage() {
  // await requireAdmin(); // protect the dashboard
  const stats = await getAdminDashboard();

  return (
    <main className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <Link className="rounded-xl border px-3 py-2" href="/admin/private/uploader">New product</Link>
          <Link className="rounded-xl border px-3 py-2" href="/orders">View orders</Link>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Products"  value={stats.productCount}  href="/admin/private/editor" />
        <StatCard title="Categories" value={stats.categoryCount} href="/categories" />
        <StatCard title="Users"      value={stats.userCount}     href="/users" />
        <StatCard title="Orders"     value={stats.orderCount}     href="/orders" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border p-5">
          <div className="mb-3 text-sm text-muted-foreground">Sales</div>
          <div className="text-3xl font-bold">
            ${stats.totalSales.toFixed(2)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">All-time gross sales</p>
        </div>

        <div className="rounded-2xl border p-5">
          <div className="mb-3 text-sm text-muted-foreground">Quick Links</div>
          <ul className="space-y-2 text-sm">
            <li><Link className="underline" href="/admin/private/editor">Manage products</Link></li>
            <li><Link className="underline" href="/admin/private/uploader">Create product</Link></li>
            <li><Link className="underline" href="/categories">Manage categories</Link></li>
            <li><Link className="underline" href="/users">Users</Link></li>
          </ul>
        </div>
      </section>
    </main>
  );
}
