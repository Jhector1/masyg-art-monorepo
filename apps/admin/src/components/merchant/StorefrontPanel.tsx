"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { storeQuery } from "@/lib/merchant-navigation";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { callMerchant, mutatable, primary, secondary, Status } from "./shared";

export default function StorefrontPanel({ store }: { store: StoreChoice }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function change() {
    setBusy(true); setError(""); setSuccess("");
    try {
      await callMerchant(`/api/merchant/organizations/${store.organizationId}/stores/${store.storeId}`, "PATCH", { published: !store.published });
      setSuccess(store.published ? "Store unpublished" : "Store published"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update storefront"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{store.storeName}</h2><Status value={store.published ? "PUBLISHED" : "DRAFT"}/></div>
    <p className="text-sm leading-6 text-zinc-600">Store-level publication controls whether published product listings appear in the public API. It never activates checkout or payments.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    <div className="flex flex-wrap items-center gap-3">
      {mutatable(store) ? <button type="button" disabled={busy} className={store.published ? secondary : primary} onClick={() => void change()}>{busy ? "Updating…" : store.published ? "Unpublish storefront" : "Publish storefront"}</button> : <p className="text-sm text-zinc-500">Read-only access</p>}
      <Link href={`/merchant/storefronts/settings${storeQuery(store.storeId)}`} className={secondary}>Store settings &amp; preview IDs</Link>
    </div>
  </section>;
}
