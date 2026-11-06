// apps/admin/src/app/page.tsx
import Link from "next/link";

export default function IndexPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="text-sm text-zinc-600">Go to your admin dashboard:</p>
      <Link href="/merchant/register" className="inline-flex rounded-xl border px-3 py-2 text-sm font-medium">
        Create your merchant account
      </Link>
      <Link href="/merchant/onboarding" className="inline-flex rounded-xl border px-3 py-2 text-sm font-medium ml-2">
        Create your storefront
      </Link>
      <Link
        href="/admin"
        className="inline-flex rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90
                   dark:bg-white dark:text-zinc-900"
      >
        Open Dashboard
      </Link>
    </main>
  );
}
