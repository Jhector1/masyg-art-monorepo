"use client";
import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { slugify } from "@/components/merchant/shared";
type Membership = { role: string; organization: { id: string; name: string; stores: Array<{ id: string; name: string }> } };
const field = "mt-1 w-full rounded-xl border border-zinc-300 p-3 text-sm";
export default function MerchantOnboardingForm() {
  const [orgName, setOrgName] = useState(""); const [orgSlug, setOrgSlug] = useState("");
  const [storeName, setStoreName] = useState(""); const [storeSlug, setStoreSlug] = useState("");
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [done, setDone] = useState(false); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { void fetch("/api/merchant/organizations", { cache: "no-store" }).then(async res => {
    if (res.status === 428) { location.assign("/merchant/security?next=/merchant/onboarding"); return; }
    if (!res.ok) throw new Error(`Unable to load organizations (${res.status})`);
    setMemberships(await res.json());
  }).catch(e => setError(e instanceof Error ? e.message : "Unable to load organizations")); }, []);
  async function create(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/merchant/organizations", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName: orgName,
          organizationSlug: orgSlug, storeName, storeSlug }) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 428) { location.assign("/merchant/security?next=/merchant/onboarding"); return; }
      if (!res.ok) throw new Error(data.error || `Unable to create store (${res.status})`);
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create your store"); }
    finally { setLoading(false); }
  }
  return <main className="mx-auto max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
    <h1 className="text-3xl font-bold">Create your storefront</h1>
    {done ? <section className="space-y-4"><p>Your organization and first store were created in draft mode.</p>
      <h2 className="font-semibold">Would you like to enable two-factor authentication?</h2>
      <p className="text-sm text-zinc-600">Optional, but recommended for accounts that manage orders or payments.</p>
      <div className="flex gap-3 flex-wrap"><Link className="rounded-xl bg-zinc-900 px-4 py-2 text-white" href="/merchant/security">Enable 2FA</Link>
        <Link className="rounded-xl border px-4 py-2" href="/merchant">Not now — go to Merchant Admin</Link></div>
    </section> : memberships === null ? <p>Loading your merchant access…</p>
      : memberships.length ? <section className="space-y-3"><p>You already belong to an organization. Open your existing merchant workspace rather than creating a duplicate organization.</p>
        <Link href="/merchant" className="inline-block rounded-xl bg-zinc-900 px-4 py-2 text-white">Open Merchant Admin</Link>
        <Link href="/merchant/security" className="ml-3 underline">2FA settings</Link></section>
      : <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Organization name<input required maxLength={120} value={orgName} onChange={e=> { setOrgName(e.target.value); setOrgSlug(slugify(e.target.value)); }} className={field}/></label>
        <label className="text-sm">Organization slug<input required value={orgSlug} onChange={e=>setOrgSlug(e.target.value)} className={field}/></label>
        <label className="text-sm">Store name<input required maxLength={120} value={storeName} onChange={e=> { setStoreName(e.target.value); setStoreSlug(slugify(e.target.value)); }} className={field}/></label>
        <label className="text-sm">Store slug<input required value={storeSlug} onChange={e=>setStoreSlug(e.target.value)} className={field}/></label>
        <p className="sm:col-span-2 text-xs text-zinc-500">Your store starts unpublished. You can add physical products, downloadable art, or both.</p>
        <button disabled={loading} className="rounded-xl bg-zinc-900 px-4 py-2 font-semibold text-white disabled:opacity-50 sm:col-span-2">Create my store</button>
      </form>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </main>;
}
