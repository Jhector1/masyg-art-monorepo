// src/app/admin/verify-2fa/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Verify2FA() {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/admin";

  const send = async () => {
    setErr(null);
    const r = await fetch("/api/admin/2fa/send", { method: "POST" });
    if (!r.ok) setErr((await r.json()).error ?? "Failed to send code");
    else setSent(true);
  };

  useEffect(() => {
    // Auto-send once when the page loads if we haven't yet
    send().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async () => {
    setErr(null);
    const r = await fetch("/api/admin/2fa/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!r.ok) setErr((await r.json()).error ?? "Invalid code");
    else router.replace(next);
  };

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Admin verification</h1>
      <p className="text-sm mb-4">
        We emailed a 6-digit code to your account email. Didn’t get it? Click resend.
      </p>

      <button onClick={send} className="rounded px-3 py-2 border mb-4">
        {sent ? "Resend code" : "Send code"}
      </button>

      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="Enter 6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded border px-3 py-2 mb-2"
      />
      <button onClick={verify} className="rounded px-3 py-2 border w-full">
        Verify
      </button>

      {err && <p className="text-red-600 mt-3 text-sm">{err}</p>}
      <p className="text-xs text-gray-500 mt-4">The code expires in 5 minutes.</p>
    </main>
  );
}
