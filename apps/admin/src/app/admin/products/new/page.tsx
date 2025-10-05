import NewProductUploader from "@acme/ui/components/admin/NewProductUploader";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Product</h1>
      <NewProductUploader />
    </div>
  );
}
