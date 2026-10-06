"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

function safeInternalPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, window.location.origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export default function SsoCompleteClient({
  code,
  callbackUrl,
}: {
  code: string;
  callbackUrl: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      const destination = safeInternalPath(callbackUrl);
      sessionStorage.setItem("jeanyves-customer-sso-probe-v2", String(Date.now()));
      window.history.replaceState(null, "", "/authenticate/sso");

      if (!/^[A-Za-z0-9_-]{32,256}$/.test(code)) {
        if (!cancelled) setFailed(true);
        return;
      }

      const result = await signIn("customer-sso", {
        code,
        redirect: false,
        callbackUrl: destination,
      });

      if (cancelled) return;
      if (!result?.ok || result.error) {
        setFailed(true);
        return;
      }

      window.location.replace(result.url || destination);
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [callbackUrl, code]);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-medium text-neutral-900">
        {failed ? "Sign-in could not be completed" : "Signing you in…"}
      </h1>
      {failed ? (
        <a className="mt-4 inline-block underline" href="/authenticate">
          Try again
        </a>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">Connecting your customer account.</p>
      )}
    </main>
  );
}
