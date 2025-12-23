// src/lib/checkout/useResumeCheckout.ts
"use client";

import * as React from "react";
import type { ResumeInfo, ResumeState } from "./reservation";

export function useResumeCheckout(enabled: boolean) {
  const [resume, setResume] = React.useState<ResumeInfo | null>(null);
  const [state, setState] = React.useState<ResumeState>("idle");

  const refresh = React.useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/checkout/resume", {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        setResume(null);
        setState("done");
        return;
      }

      const json = await res.json();
      if (json?.url && json?.orderId) {
        setResume({
          url: json.url,
          orderId: json.orderId,
          expiresAt: json.expiresAt ?? null,
        });
      } else {
        setResume(null);
      }
    } catch {
      setResume(null);
    } finally {
      setState("done");
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setResume(null);
      setState("idle");
      return;
    }
    refresh();
  }, [enabled, refresh]);

  return { resume, state, refresh };
}
