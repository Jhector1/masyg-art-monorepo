import DataTable from "@/components/admin/DataTable";
import { CategoryForm } from "@/components/admin/CategoryForm";
import ClientActions from "./ClientActions";
import { requireAdmin } from "@/lib/require-admin";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CategoriesPage() {
      await requireAdmin();
    
  const { listCategories } = await import("@/services/admin/categories");
  const rows = await listCategories();

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        {/* ⬇️ no onSaved prop */}
        <CategoryForm />
      </header>

      <DataTable
        rows={rows}
        cols={[
          { header: "Name", key: "name" },
          { header: "Products", key: "_count", render: (r: any) => r._count.products },
          { header: "Actions", key: "id", render: (r: any) => <ClientActions row={r} />, className: "w-48" },
        ]}
      />
    </main>
  );
}
