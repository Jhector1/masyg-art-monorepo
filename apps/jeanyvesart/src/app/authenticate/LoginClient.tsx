"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/";

  useEffect(() => {
    const start = new URL("/api/auth/sso/start", window.location.origin);
    start.searchParams.set("force", "1");
    start.searchParams.set("returnTo", callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/");
    window.location.replace(start.toString());
  }, [callbackUrl]);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-medium text-neutral-900">Connecting your account…</h1>
      <p className="mt-2 text-sm text-neutral-500">You’ll return here automatically.</p>
    </main>
  );
}
