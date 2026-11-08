import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IndexPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/merchant");
  return <main className="mx-auto max-w-3xl space-y-5 p-6 sm:py-16">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-700">ZileDigital</p>
    <h1 className="text-4xl font-bold tracking-tight">Manage your storefronts in one place</h1>
    <p className="text-zinc-600">Sign in to choose your storefront, manage your products, and handle orders.</p>
    <div className="flex flex-wrap gap-3">
      <Link href="/merchant/signin" className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white">Sign in to your stores</Link>
      <Link href="/merchant/register" className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold">Create merchant account</Link>
    </div>
  </main>;
}
