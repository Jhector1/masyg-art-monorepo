"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { callMerchant, field, mutatable, primary, secondary, slugify } from "./shared";

type Category = { id: string; name: string; slug: string; _count: { productLinks: number } };
export default function CategoryManager({ store, categories }: { store: StoreChoice; categories: Category[] }) {
  const router = useRouter(); const canEdit = mutatable(store);
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const base = `/api/merchant/organizations/${store.organizationId}/categories`;
  async function run(work: () => Promise<unknown>, message: string) {
    if (busy || !canEdit) return false; setBusy(true); setError(""); setSuccess("");
    try { await work(); setSuccess(message); router.refresh(); return true; }
    catch(e) { setError(e instanceof Error ? e.message : "Category operation failed"); return false; }
    finally { setBusy(false); }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (await run(() => callMerchant(base, "POST", { name, slug }), "Category created")) { setName(""); setSlug(""); }
  }
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    {canEdit && <form className="rounded-2xl border bg-white p-5 shadow-sm" onSubmit={e => void create(e)}><h2 className="text-lg font-semibold">New category</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-medium">Category name<input className={field} value={name} required maxLength={100} onChange={e => { setName(e.target.value); setSlug(slugify(e.target.value)); }}/></label>
      <label className="text-sm font-medium">URL slug<input className={field} required maxLength={63} value={slug} onChange={e => setSlug(e.target.value)}/></label>
      <button className={`${primary} self-end`} disabled={busy || !name || !slug}>Add category</button></div></form>}
    <section className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Organization categories</h2>
      <p className="text-xs text-zinc-500">Categories can be shared by multiple products and storefronts in this organization. Assigned categories cannot be deleted.</p>
      {categories.map(c => <CategoryRow key={c.id} category={c} canEdit={canEdit} busy={busy} save={(body) => run(() => callMerchant(`${base}/${c.id}`, "PATCH", body), "Category saved")}
        remove={() => run(() => callMerchant(`${base}/${c.id}`, "DELETE"), "Category deleted")}/>) }
      {!categories.length && <p className="text-sm text-zinc-500">No categories yet.</p>}
    </section>
  </div>;
}
function CategoryRow({ category, canEdit, busy, save, remove }: { category: Category; canEdit: boolean; busy: boolean;
  save: (v: { name: string; slug: string }) => void; remove: () => void }) {
  const [name, setName] = useState(category.name); const [slug, setSlug] = useState(category.slug);
  return <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
    <label className="text-xs font-medium">Name<input className={field} value={name} disabled={!canEdit} maxLength={100} onChange={e => setName(e.target.value)}/></label>
    <label className="text-xs font-medium">Slug<input className={field} value={slug} disabled={!canEdit} maxLength={63} onChange={e => setSlug(e.target.value)}/></label>
    <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-zinc-500">{category._count.productLinks} product(s)</span>{canEdit && <button className={secondary} type="button" disabled={busy || !name || !slug} onClick={() => save({ name, slug })}>Save</button>}
    {canEdit && <button className="text-xs font-medium text-red-700 disabled:opacity-40" type="button" disabled={busy || category._count.productLinks > 0} title={category._count.productLinks ? "Remove product assignments first" : "Delete category"} onClick={() => { if (window.confirm(`Delete category ${category.name}?`)) remove(); }}>Delete</button>}</div></div>;
}
