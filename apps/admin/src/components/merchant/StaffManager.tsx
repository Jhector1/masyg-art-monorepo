"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { callMerchant, field, primary, secondary } from "./shared";
import type { StoreChoice } from "@/lib/merchant-workspace";
type Role = "OWNER" | "ADMIN" | "MEMBER";
type StaffRow = { userId: string; role: Role; createdAt: string | Date; user: { id: string; name: string | null; email: string } };
export default function StaffManager({ store, stores, rows, currentUserId }: { store: StoreChoice; stores: StoreChoice[]; rows: StaffRow[]; currentUserId: string }) {
  const router = useRouter(); const canEdit = store.role === "OWNER";
  const [email,setEmail] = useState(""); const [role,setRole] = useState<Role>("MEMBER");
  const [viewerStore,setViewerStore] = useState(store.storeId);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [success,setSuccess] = useState("");
  const root = `/api/merchant/organizations/${store.organizationId}/staff`;
  const orgStores = stores.filter(s=>s.organizationId===store.organizationId);
  async function run(action: () => Promise<unknown>, message: string) {
    if (!canEdit || busy) return false;
    setBusy(true); setError(""); setSuccess("");
    try { await action();setSuccess(message);router.refresh();return true; }
    catch(e) { setError(e instanceof Error ? e.message : "Staff update failed");return false; }
    finally {setBusy(false);}
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (role === "OWNER" && !window.confirm(`Grant full organization ownership to ${email.trim()}?`)) return;
    if(await run(()=>callMerchant(root,"POST",{ email: email.trim(),role, ...(role==="MEMBER" ? {storeId:viewerStore} : {}) }),"Staff access added"))setEmail("");
  }
  async function change(row: StaffRow, next: Role) {
    if (row.role===next) return;
    if(!window.confirm(`Change ${row.user.email} from ${row.role} to ${next}?`))return;
    await run(()=>callMerchant(`${root}/${encodeURIComponent(row.userId)}`,"PATCH",{role:next,...(next==="MEMBER" ? {storeId:viewerStore} : {})}),"Role updated");
  }
  async function remove(row: StaffRow) {
    if(!window.confirm(`Revoke ${row.user.email}'s access to ${store.organizationName}?`))return;
    await run(()=>callMerchant(`${root}/${encodeURIComponent(row.userId)}`,"DELETE"),"Staff access revoked");
  }
  return <div className="space-y-5">
    {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {success && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Organization members</h2><p className="mt-2 text-xs text-zinc-500">OWNER can manage team access. ADMIN can manage the catalog and read orders and customers. MEMBER is limited to a selected storefront as VIEWER. Editing and invitations require separately reviewed workflows.</p>
    <div className="mt-4 divide-y">{rows.map(row=><div key={row.userId} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{row.user.name || row.user.email} {row.userId===currentUserId && <span className="text-xs text-zinc-500">(you)</span>}</p><p className="text-xs text-zinc-500">{row.user.email}</p></div><div className="flex items-center gap-2">{canEdit && row.userId!==currentUserId ? <><select aria-label={`Role for ${row.user.email}`} value={row.role} disabled={busy} className="rounded-xl border px-3 py-2 text-sm" onChange={e=>void change(row,e.target.value as Role)}><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="MEMBER">Viewer member</option></select><button type="button" className={secondary} disabled={busy} onClick={()=>void remove(row)}>Remove</button></> : <span className="rounded-full border bg-zinc-50 px-3 py-1 text-xs font-semibold">{row.role}</span>}</div></div>)}</div></section>
    {canEdit && <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Add existing account</h2><p className="mt-1 text-xs text-zinc-500">The person must already have a ZileDigital account. This action grants access immediately; it does not send an email invitation.</p><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e=>void add(e)}><label className="text-sm font-medium">Registered email<input className={field} type="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="text-sm font-medium">Organization role<select className={field} value={role} onChange={e=>setRole(e.target.value as Role)}><option value="MEMBER">Storefront viewer</option><option value="ADMIN">Organization admin</option><option value="OWNER">Organization owner</option></select></label>
      <label className="text-sm font-medium sm:col-span-2">Viewer storefront<select className={field} value={viewerStore} onChange={e=>setViewerStore(e.target.value)}>{orgStores.map(s=><option key={s.storeId} value={s.storeId}>{s.storeName}</option>)}</select><p className="mt-1 text-xs font-normal text-zinc-500">Applied when adding or changing to MEMBER. Other roles can access all storefronts in the organization.</p></label>
      <button type="submit" className={`${primary} sm:col-span-2 sm:justify-self-start`} disabled={busy||!email.trim()||role==="MEMBER"&&!viewerStore}>{busy?"Saving…":"Add to organization"}</button></form></section>}
  </div>;
}
