"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm";
async function api(path: string, value: unknown) {
  const res = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export default function RegisterMerchant() {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [token, setToken] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState<boolean | null>(null);
  useEffect(() => { const fragment = new URLSearchParams(location.hash.slice(1));
    const value = fragment.get("verify"); if (value) { setToken(value); history.replaceState(null, "", location.pathname); }
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/merchant/auth/register", { cache: "no-store" })
      .then(res => res.ok ? res.json() : Promise.reject(new Error("Unavailable")))
      .then(data => { if (active) setEmailVerificationRequired(data.emailVerificationRequired !== false); })
      .catch(() => { if (active) setEmailVerificationRequired(true); });
    return () => { active = false; };
  }, []);
  const submit = async (path: string, data: unknown) => {
    setBusy(true); setMessage("");
    try { const result = await api(path, data);
      setMessage(path.endsWith("/verify") && result.ok
        ? "Email verified. Sign in to create your store." : result.message || "Check your email for the verification link.");
      if (path.endsWith("/register")) setPassword("");
      if (path.endsWith("/verify")) setToken("");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to continue"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
    <h1 className="text-3xl font-bold">Create a merchant account</h1>
    <p className="text-sm text-zinc-600">Create your own organization and store, without platform administrator permissions.
      {emailVerificationRequired === true ? " Email verification is required before sign-in." :
        emailVerificationRequired === false ? " Email verification is not required for registration in this environment." : ""}</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit("/api/merchant/auth/register", { name, email, password }); }}>
      <label className="block text-sm">Your name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={field}/></label>
      <label className="block text-sm">Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={field}/></label>
      <label className="block text-sm">Password (12+ characters)<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} className={field}/></label>
      <button disabled={busy} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Create account</button>
    </form>
    {emailVerificationRequired !== false && <section className="space-y-2 border-t pt-4">
      <h2 className="font-semibold">Verify your email</h2>
      <form onSubmit={e => { e.preventDefault(); void submit("/api/merchant/auth/verify", { token }); }} className="flex gap-2">
        <input value={token} onChange={e => setToken(e.target.value)} placeholder="Verification token from your email" className={field} required/>
        <button disabled={busy} className="rounded-xl border px-3 text-sm">Verify</button>
      </form>
      <button disabled={busy || !email} className="text-sm underline" onClick={() => void submit("/api/merchant/auth/resend", { email })}>Resend verification email</button>
    </section>}
    {message && <p role="status" className="rounded-lg bg-zinc-100 p-3 text-sm">{message}</p>}
    <p className="text-sm"><Link className="underline" href="/merchant/signin?callbackUrl=/merchant/onboarding">Sign in with your account or Google</Link></p>
    <p className="text-xs text-zinc-500">Two-factor authentication is optional; you can enroll after creating your store.</p>
  </main>;
}
