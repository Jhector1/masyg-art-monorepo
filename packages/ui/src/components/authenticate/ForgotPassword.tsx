// ============================================================
// 3) API: change-password (uses your existing route; unchanged except optional redirect note)
// ============================================================
// File: src/app/api/auth/change-password/route.ts
// (Use what you already have; no redirect from the API — the UI redirects.)

// ============================================================
// 4) UI: Forgot Password page (request reset email)
// ============================================================
// File: src/app/auth/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/profile";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send email");
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white dark:bg-neutral-900 rounded-2xl shadow">
      <h1 className="text-xl font-semibold mb-2">Forgot password</h1>
      <p className="text-sm text-gray-600 dark:text-neutral-300 mb-4">
        Enter your email and we’ll send a link to reset your password.
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {sent ? (
        <p className="text-sm">If an account exists for <b>{email}</b>, a reset link has been sent.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border px-3 py-2"
            required
            autoComplete="email"
          />
          <button type="submit" disabled={loading} className="w-full rounded-md bg-indigo-600 text-white py-2 disabled:opacity-60">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </div>
  );
}

