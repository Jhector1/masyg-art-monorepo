import ProductAssetsTable from "@acme/ui/components/admin/ProductAssetsTable";
import ProductEditorForm from "@acme/ui/components/admin/ProductEditorForm";
import { prisma } from "@acme/core/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const {id} = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, assets: true },
  });
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  if (!product) return notFound();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Edit Product</h1>
      <ProductEditorForm product={product} categories={categories} />
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Assets</h2>
        <ProductAssetsTable assets={product.assets} />
      </div>
    </div>
  );
}
