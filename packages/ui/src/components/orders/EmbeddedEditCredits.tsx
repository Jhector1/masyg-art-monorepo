"use client";
import { useEffect, useRef, useState } from "react";
import { startEmbeddedCheckout, destroyEmbeddedCheckout } from "@acme/core/lib/embeddedCheckoutManager";

type EmbeddedCtrl = { destroy: () => void; mount: (el: HTMLElement | string) => void };
type Quota = "export" | "edit";

export default function EmbeddedQuotaCheckout({
  quota,
  productId,
  packKey,
  quantity = 1,
  open = true,
  onApplied,
}: {
  quota: Quota; productId: string; packKey?: "10" | "50" | "200"; quantity?: number;
  open?: boolean; onApplied?: (amount: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const ctrlRef = useRef<EmbeddedCtrl | null>(null);

  // ✅ callback ref so effect re-runs when the element is actually in the DOM
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !containerEl) return;

    let cancelled = false;
    setBusy(true);

    (async () => {
      try {
        // wait one frame so the container is painted
        await new Promise((r) => requestAnimationFrame(r));

        const ctrl = await startEmbeddedCheckout(
          async (stripe) =>
            await stripe.initEmbeddedCheckout({
              async fetchClientSecret() {
                const res = await fetch("/api/checkout/quota/session", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ quota, productId, packKey, quantity }),
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}));
                  throw new Error(j?.error || "Failed to create session");
                }
                const { clientSecret, sessionId } = await res.json();
                sessionIdRef.current = sessionId;
                return clientSecret;
              },
              onComplete: async () => {
                try {
                  const r = await fetch("/api/checkout/apply-quota", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ sessionId: sessionIdRef.current }),
                  });
                  const data = await r.json().catch(() => ({}));
                  const amount = Number(quota === "export" ? data?.exports ?? 0 : data?.edits ?? 0);
                  onApplied?.(Number.isFinite(amount) ? amount : 0);
                } catch {}
                setComplete(true);
                destroyEmbeddedCheckout(ctrlRef.current || undefined);
                ctrlRef.current = null;
              },
            }),
          async (rawCtrl) => {
            if (cancelled) {
              try { (rawCtrl as any).destroy?.(); } catch {}
              return;
            }
            // final sanity check
            if (!containerEl) throw new Error("Mount container not found (after RAF)");
            const ec = rawCtrl as unknown as EmbeddedCtrl;
            ec.mount(containerEl);
            ctrlRef.current = ec;
          }
        );

        if (cancelled && ctrl) destroyEmbeddedCheckout(ctrl as any);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Checkout failed to initialize");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      destroyEmbeddedCheckout(ctrlRef.current || undefined);
      ctrlRef.current = null;
    };
  }, [open, containerEl, quota, productId, packKey, quantity, onApplied]);

  return (
    <div className="max-w-[560px] w-full">
      {!complete && (
        // ⬇️ use the callback ref, not useRef.current
        <div ref={setContainerEl} className="min-h-[clamp(480px,80dvh,720px)]" />
      )}
      {busy && <p className="text-sm text-black/60 mt-2">Loading checkout…</p>}
      {error && <p className="text-sm text-red-600 mt-2">{String(error)}</p>}
      {complete && (
        <div className="p-4 rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
          <p className="font-medium">Payment complete ✅</p>
          <p className="text-sm text-emerald-900/80">Your credits were added.</p>
        </div>
      )}
    </div>
  );
}
