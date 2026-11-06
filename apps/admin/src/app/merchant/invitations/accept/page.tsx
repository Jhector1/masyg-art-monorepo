"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function InvitationAcceptance() {
  const [token, setToken] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [success,setSuccess] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const value = hash.get("token");
    if (value && /^[A-Za-z0-9_-]{40,90}$/.test(value)) setToken(value);
    else setMessage("No valid invitation token was found. Open the original emailed invitation link.");
  }, []);
  async function accept() {
    if (!token || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/merchant/invitations/accept", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type":"application/json" }, cache:"no-store", body:JSON.stringify({token}) });
      const result: unknown = await response.json().catch(()=>null);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sign in using the invited email, then reopen this invitation link.");
        const err = result && typeof result === "object" && "error" in result ? (result as {error:unknown}).error : undefined;
        throw new Error(typeof err === "string" ? err : "Invitation not available");
      }
      window.history.replaceState(null,"",window.location.pathname);
      setToken(""); setSuccess(true); setMessage("Invitation accepted. Your new organization access is ready.");
    } catch (error) {setMessage(error instanceof Error ? error.message : "Could not accept invitation");}
    finally {setBusy(false);}
  }
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Accept staff invitation</h1>
    <p className="mt-3 text-sm text-zinc-600">Use the invited email address to sign in. The link can be accepted only once and expires after seven days.</p>
    {message && <p role="status" className="mt-5 rounded-xl border p-4 text-sm">{message}</p>}
    <div className="mt-5 flex gap-3">{!success && <button type="button" disabled={!token||busy} onClick={()=>void accept()} className="rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white disabled:opacity-40">{busy?"Accepting…":"Accept invitation"}</button>}
      <Link href="/api/auth/signin" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Sign in</Link>
      {success && <Link href="/merchant" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Open merchant Admin</Link>}
    </div><p className="mt-4 text-xs text-zinc-500">If you need to sign in first, keep this invitation tab open and return to it afterward.</p>
  </main>;
}
