"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type State = { enabled: boolean; pending: boolean };
type Enroll = { secret: string; uri: string };
async function post(path: string, body: unknown) {
  const res = await fetch(`/api/merchant/security/${path}`, { method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export default function MerchantSecurityControls() {
  const [status, setStatus] = useState<State | null>(null);
  const [enroll, setEnroll] = useState<Enroll | null>(null); const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]); const [error, setError] = useState("");
  const [success, setSuccess] = useState(""); const [busy, setBusy] = useState(false);
  const refresh = () => fetch("/api/merchant/security/status", { cache: "no-store" })
    .then(async r => { if (!r.ok) throw new Error(`Unable to read security settings (${r.status})`); setStatus(await r.json()); });
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
  const act = async (path: string, body: unknown) => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await post(path, body);
      if (path === "enroll") setEnroll(result);
      if (path === "confirm") { setRecovery(result.recoveryCodes); setEnroll(null); setCode(""); setSuccess("2FA enabled. Save your one-time recovery codes offline."); }
      if (path === "challenge") { setCode(""); setSuccess("Second factor verified. You can open Merchant Admin."); }
      if (path === "disable") { setCode(""); setRecovery([]); setSuccess("2FA disabled for your merchant account."); }
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to continue"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
    <h1 className="text-3xl font-bold">Merchant two-factor authentication</h1>
    <p className="text-sm text-zinc-600">Optional for merchant accounts. Platform administrators still follow their separate mandatory security policy.</p>
    {status ? status.enabled ? <section className="space-y-3">
      <p className="font-semibold text-emerald-700">2FA is enabled</p>
      <p className="text-sm">Enter a current authenticator code or one of your unused recovery codes to unlock your merchant session.</p>
      <input aria-label="Authentication code" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.trim())} placeholder="6-digit code or recovery code" className="w-full rounded-xl border p-3" />
      <div className="flex flex-wrap gap-3"><button disabled={busy || !code} className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-50" onClick={() => void act("challenge", { code })}>Verify 2FA</button>
        <button disabled={busy || !code} className="rounded-xl border px-4 py-2 text-red-700 disabled:opacity-50" onClick={() => { if (confirm("Disable 2FA for this merchant account?")) void act("disable", { code, confirm: "DISABLE" }); }}>Disable 2FA</button></div>
    </section> : <section className="space-y-3"><p>2FA is currently off. You can continue without it.</p>
      <button disabled={busy} className="rounded-xl bg-zinc-900 px-4 py-2 text-white" onClick={() => void act("enroll", {})}>Set up authenticator app</button>
      {enroll && <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-semibold">Add this setup key to your authenticator app. It expires in 10 minutes.</p>
        <code className="block break-all rounded-lg bg-zinc-100 p-3 font-mono text-sm">{enroll.secret}</code>
        <p className="text-xs text-zinc-600">Choose time-based (TOTP), six digits. If your app supports an otpauth URI, use the link below.</p>
        <code className="block break-all rounded-lg bg-zinc-100 p-2 font-mono text-xs">{enroll.uri}</code>
        <input aria-label="First authenticator code" autoComplete="one-time-code" placeholder="Enter 6-digit code to activate" className="w-full rounded-xl border p-3" value={code} onChange={e=>setCode(e.target.value.trim())}/>
        <button disabled={busy || !/^\d{6}$/.test(code)} className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-50" onClick={() => void act("confirm", { code })}>Confirm and enable 2FA</button>
      </div>}</section> : <p>Loading security settings…</p>}
    {recovery.length > 0 && <section className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="font-semibold">Save your recovery codes now</h2><p className="text-sm">Each can be used once. These codes will not be displayed again.</p>
      <div className="grid grid-cols-2 gap-2">{recovery.map(c => <code key={c}>{c}</code>)}</div>
      <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => { void navigator.clipboard.writeText(recovery.join("\n")); }}>Copy codes</button>
      <button className="ml-2 text-sm underline" onClick={() => setRecovery([])}>I've saved these codes</button>
    </section>}
    {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Link href="/merchant" className="inline-block rounded-xl border px-4 py-2 text-sm">Open Merchant Admin</Link>
  </main>;
}
