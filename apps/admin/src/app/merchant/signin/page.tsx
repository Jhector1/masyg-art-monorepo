"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

function safeMerchantDestination(raw: string | null): string {
  if (!raw) return "/merchant";
  try {
    // Only merchant-local paths are allowed as post-login destinations.
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin ||
        !(url.pathname === "/merchant" || url.pathname.startsWith("/merchant/")) ||
        url.pathname.startsWith("/merchant/signin") || url.pathname.startsWith("/merchant/register") ||
        raw.startsWith("//")) return "/merchant";
    return `${url.pathname}${url.search}`;
  } catch { return "/merchant"; }
}

export default function MerchantSignInPage() {
  const [destination, setDestination] = useState("/merchant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDestination(safeMerchantDestination(new URLSearchParams(window.location.search).get("callbackUrl")));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await signIn("credentials", { redirect: false, email, password, callbackUrl: destination });
      if (!result?.ok || result.error) {
        setError("Unable to sign in. Check your credentials and verify your email if you just registered.");
        return;
      }
      window.location.assign(destination);
    } catch { setError("Unable to sign in. Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-md space-y-5 rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">ZileDigital Merchant</p>
        <h1 className="text-3xl font-bold tracking-tight">Sign in to your store</h1>
        <p className="text-sm text-zinc-600">Use your merchant account. Platform administration is managed separately.</p>
      </div>
      <button type="button" disabled={busy} onClick={() => { setError(""); void signIn("google", { callbackUrl: destination }); }}
        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50">
        Continue with Google
      </button>
      <div className="text-center text-xs text-zinc-500">or sign in with email</div>
      <form className="space-y-3" onSubmit={event => { void submit(event); }}>
        <label className="block space-y-1 text-sm font-medium">Email
          <input className="w-full rounded-xl border border-zinc-300 px-3 py-2.5" autoComplete="username" type="email" required value={email} onChange={e => setEmail(e.target.value)}/>
        </label>
        <label className="block space-y-1 text-sm font-medium">Password
          <input className="w-full rounded-xl border border-zinc-300 px-3 py-2.5" autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)}/>
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} type="submit" className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm text-zinc-600">New merchant? <Link className="font-semibold underline" href="/merchant/register">Create an account</Link></p>
    </main>
  );
}
