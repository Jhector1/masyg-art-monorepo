"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const PROBE_KEY = "jeanyves-customer-sso-probe-v2";
const PROBE_COOLDOWN_MS = 5_000;

export default function CustomerSsoBootstrap() {
  const pathname = usePathname();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (pathname.startsWith("/authenticate")) return;

    const maybeProbe = () => {
      if (document.visibilityState === "hidden") return;

      try {
        const previous = Number(sessionStorage.getItem(PROBE_KEY) || "0");
        if (Number.isFinite(previous) && Date.now() - previous < PROBE_COOLDOWN_MS) {
          return;
        }
        sessionStorage.setItem(PROBE_KEY, String(Date.now()));
      } catch {
        // If sessionStorage is unavailable, a top-level probe is still safe.
      }

      const returnTo = `${pathname}${window.location.search}`;
      const start = new URL("/api/auth/sso/start", window.location.origin);
      start.searchParams.set("returnTo", returnTo);
      window.location.replace(start.toString());
    };

    maybeProbe();
    window.addEventListener("focus", maybeProbe);
    document.addEventListener("visibilitychange", maybeProbe);

    return () => {
      window.removeEventListener("focus", maybeProbe);
      document.removeEventListener("visibilitychange", maybeProbe);
    };
  }, [pathname, status]);

  return null;
}
