"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { callMerchant, primary, field } from "./shared";
type Row = { id: string; body: string; actorUserId: string; createdAt: Date | string };
export default function CustomerNotes({ organizationId, storeId, customerId, rows }: {
  organizationId:string; storeId:string; customerId:string; rows:Row[];
}) {
  const router=useRouter(); const [body,setBody]=useState(""); const [busy,setBusy]=useState(false);
  const [error,setError]=useState(""); const [message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy) return;
    setBusy(true);setError("");setMessage("");
    try { await callMerchant(`/api/merchant/organizations/${organizationId}/stores/${storeId}/customers/${customerId}/notes`,"POST",{body:body.trim()});
      setBody("");setMessage("Private note added");router.refresh();}
    catch(error){setError(error instanceof Error?error.message:"Could not add note");}
    finally {setBusy(false);}
  }
  return <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Private storefront notes</h2>
    <p className="mt-1 text-xs text-zinc-500">Visible only to authorized merchant administrators for this storefront. Never included in customer receipts or public APIs.</p>
    {error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{message&&<p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    <form onSubmit={e=>void submit(e)} className="mt-4 space-y-3"><label className="block text-sm font-semibold">New note<textarea className={field} rows={3} minLength={1} maxLength={2000} required value={body} onChange={e=>setBody(e.target.value)} placeholder="Internal follow-up or service context"/></label>
      <button type="submit" disabled={busy||!body.trim()} className={primary}>{busy?"Saving…":"Add private note"}</button></form>
    <div className="mt-5 divide-y">{rows.map(row=><div key={row.id} className="py-3"><p className="whitespace-pre-wrap break-words text-sm">{row.body}</p><p className="mt-1 text-xs text-zinc-500">{new Date(row.createdAt).toISOString().slice(0,16).replace("T"," ")} UTC · Staff ID {row.actorUserId.slice(0,12)}</p></div>)}
      {!rows.length&&<p className="py-4 text-sm text-zinc-500">No private notes yet.</p>}</div>
  </section>;
}
