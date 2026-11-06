"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { callMerchant, field, primary, secondary } from "./shared";
import type { StoreChoice } from "@/lib/merchant-workspace";

type InvitationRow = { id: string; email: string; role: "ADMIN" | "MEMBER" | "OWNER";
  storeId: string | null; deliveryStatus: string; createdAt: Date | string; expiresAt: Date | string;
  acceptedAt: Date | string | null; revokedAt: Date | string | null };
export default function StaffInviteManager({ store, stores, rows }: {
  store: StoreChoice; stores: StoreChoice[]; rows: InvitationRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [viewerStore, setViewerStore] = useState(store.storeId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const root = `/api/merchant/organizations/${encodeURIComponent(store.organizationId)}/invitations`;
  const ownedStores = stores.filter(s => s.organizationId === store.organizationId);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await callMerchant(root,"POST",{ email: email.trim(), role, ...(role === "MEMBER" ? { storeId: viewerStore } : {}) });
      setEmail(""); setMessage("Invitation accepted by the email provider. Membership starts only after the recipient accepts.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send invitation"); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (busy || !window.confirm("Revoke this invitation? The existing link will stop working.")) return;
    setBusy(true); setError(""); setMessage("");
    try { await callMerchant(`${root}/${encodeURIComponent(id)}`,"DELETE");setMessage("Invitation revoked");router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to revoke invitation"); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
    <div><h2 className="text-lg font-semibold">Invite staff by email</h2>
      <p className="mt-1 text-xs text-zinc-500">Seven-day, single-use invitation. Viewer access is limited to one storefront. No access is granted until the recipient signs in and accepts.</p></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <form onSubmit={e=>void send(e)} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Invite email<input type="email" maxLength={254} className={field} value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label className="text-sm font-medium">Role<select className={field} value={role} onChange={e=>setRole(e.target.value as "MEMBER"|"ADMIN")}><option value="MEMBER">Storefront viewer</option><option value="ADMIN">Organization admin</option></select></label>
      {role === "MEMBER" && <label className="text-sm font-medium md:col-span-2">Viewer storefront<select className={field} value={viewerStore} onChange={e=>setViewerStore(e.target.value)}>{ownedStores.map(s=><option key={s.storeId} value={s.storeId}>{s.storeName}</option>)}</select></label>}
      <div className="md:col-span-2"><button className={primary} disabled={busy||!email||role==="MEMBER"&&!viewerStore}>{busy?"Sending…":"Send invitation"}</button></div>
    </form>
    <div className="border-t pt-4"><h3 className="font-semibold">Invitation history</h3>
      <div className="mt-2 divide-y">{rows.map(i => {
        const status = i.acceptedAt ? "Accepted" : i.revokedAt ? "Revoked" : new Date(String(i.expiresAt)).getTime() < Date.now() ? "Expired" : i.deliveryStatus === "SENT" ? "Sent — awaiting acceptance" : i.deliveryStatus;
        return <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{i.email}</p><p className="text-xs text-zinc-500">{i.role} · {status}</p></div>{!i.acceptedAt&&!i.revokedAt&&status!=="Expired" && <button type="button" disabled={busy} className={secondary} onClick={()=>void revoke(i.id)}>Revoke</button>}</div>;
      })}{rows.length===0 && <p className="py-3 text-sm text-zinc-500">No invitations yet.</p>}</div>
    </div>
  </section>;
}
