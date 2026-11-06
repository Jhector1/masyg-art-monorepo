import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";

/** Platform-only entry. Merchant commerce is administered per organization at /merchant. */
export const dynamic = "force-dynamic";
export default async function PlatformAdminPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-3xl font-semibold">Platform administration</h1>
      <p className="text-sm text-zinc-600">
        Global legacy product, category, order and customer editors have been retired.
        Merchant commerce data is scoped to an organization and storefront.
      </p>
      <p className="text-sm text-zinc-600">
        The canonical merchant console is available below for accounts with an
        organization membership. Platform administrator status alone does not grant
        access to a merchant&apos;s data.
      </p>
      <Link href="/merchant" className="inline-flex rounded-xl border px-4 py-2">
        Open merchant storefronts
      </Link>
    </main>
  );
}
