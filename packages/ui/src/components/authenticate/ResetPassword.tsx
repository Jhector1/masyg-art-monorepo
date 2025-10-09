// ============================================================
// 5) UI: Reset Password page (reads token from URL, sets new password, then redirects)
// ============================================================
// File: src/app/auth/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const callbackUrl = params.get("callbackUrl") || "/profile";

  useEffect(() => {
    if (!token) setError("Missing reset token.");
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Reset failed");

      // ✅ redirect after success — encourage login
      router.replace(`/authenticate?mode=login&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white dark:bg-neutral-900 rounded-2xl shadow">
      <h1 className="text-xl font-semibold mb-2">Reset password</h1>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          placeholder="New password"
          type="password"
          className="w-full rounded-md border px-3 py-2"
          required
          autoComplete="new-password"
          minLength={8}
        />
        <input
          value={confirmPassword}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          type="password"
          className="w-full rounded-md border px-3 py-2"
          required
          autoComplete="new-password"
          minLength={8}
        />
        <button type="submit" disabled={loading} className="w-full rounded-md bg-indigo-600 text-white py-2 disabled:opacity-60">
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

