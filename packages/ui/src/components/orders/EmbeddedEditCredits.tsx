"use client";

import { useEffect, useRef, useState } from "react";
import {
  startEmbeddedCheckout,
  destroyEmbeddedCheckout,
} from "@acme/core/lib/embeddedCheckoutManager";

type EmbeddedCtrl = {
  destroy: () => void;
  mount: (el: HTMLElement | string) => void;
};
type Quota = "export" | "edit";

type ApplyQuotaResponse = {
  applied?: boolean;
  reason?: string;
  error?: string;
  units?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function EmbeddedQuotaCheckout({
  quota,
  productId,
  packKey,
  quantity = 1,
  open = true,
  onApplied,
}: {
  quota: Quota;
  productId: string;
  packKey?: "10" | "50" | "200";
  quantity?: number;
  open?: boolean;
  onApplied?: (amount: number) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const ctrlRef = useRef<EmbeddedCtrl | null>(null);
  const completingRef = useRef(false);
  const onAppliedRef = useRef(onApplied);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    onAppliedRef.current = onApplied;
  }, [onApplied]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setComplete(false);
      setFinalizing(false);
      setError(null);
      sessionIdRef.current = null;
      completingRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !containerEl) return;

    let cancelled = false;
    setBusy(true);
    setError(null);

    const reconcilePaidQuota = async (sessionId: string): Promise<number> => {
      let lastMessage = "Credits are still syncing.";

      for (let attempt = 0; attempt < 15; attempt += 1) {
        const response = await fetch("/api/private/checkout/apply-quota", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "content-type": "application/json",
            "cache-control": "no-cache",
          },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await response.json().catch(() => ({}))) as ApplyQuotaResponse;

        if (response.ok && data.applied === true) {
          const units = Number(data.units ?? 0);
          if (!Number.isFinite(units) || units <= 0) {
            throw new Error("Payment succeeded, but Stripe returned an invalid credit amount.");
          }
          return units;
        }

        lastMessage = data.error || data.reason || `Credit reconciliation failed (${response.status})`;

        const retryable =
          data.reason === "not_paid" ||
          response.status === 408 ||
          response.status === 409 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500;

        if (!retryable) throw new Error(lastMessage);
        if (attempt < 14) await sleep(Math.min(250 + attempt * 100, 1000));
      }

      throw new Error(lastMessage);
    };

    (async () => {
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const ctrl = await startEmbeddedCheckout(
          async (stripe) =>
            await stripe.initEmbeddedCheckout({
              async fetchClientSecret() {
                const res = await fetch("/api/private/checkout/quota/session", {
                  method: "POST",
                  credentials: "include",
                  cache: "no-store",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ quota, productId, packKey, quantity }),
                });
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}));
                  throw new Error(body?.error || "Failed to create checkout session");
                }

                const { clientSecret, sessionId } = await res.json();
                if (!clientSecret || !sessionId) {
                  throw new Error("Stripe returned an incomplete checkout session.");
                }

                sessionIdRef.current = String(sessionId);
                return String(clientSecret);
              },
              onComplete: async () => {
                if (completingRef.current) return;
                completingRef.current = true;
                setFinalizing(true);
                setBusy(true);
                setError(null);

                destroyEmbeddedCheckout(ctrlRef.current || undefined);
                ctrlRef.current = null;

                try {
                  const sessionId = sessionIdRef.current;
                  if (!sessionId) throw new Error("Missing Stripe checkout session.");

                  const amount = await reconcilePaidQuota(sessionId);
                  await onAppliedRef.current?.(amount);

                  if (!cancelled) setComplete(true);
                } catch (e: any) {
                  if (!cancelled) {
                    setComplete(true);
                    setError(
                      e?.message ||
                        "Payment was received, but your credits are still being synchronized."
                    );
                  }
                } finally {
                  if (!cancelled) {
                    setBusy(false);
                    setFinalizing(false);
                  }
                  completingRef.current = false;
                }
              },
            }),
          async (rawCtrl) => {
            if (cancelled) {
              try {
                (rawCtrl as any).destroy?.();
              } catch {}
              return;
            }
            if (!containerEl) throw new Error("Checkout mount container was not found.");

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
  }, [open, containerEl, quota, productId, packKey, quantity]);

  return (
    <div className="max-w-[560px] w-full">
      {!complete && (
        <div
          ref={setContainerEl}
          className={finalizing ? "hidden" : "min-h-[clamp(480px,80dvh,720px)]"}
        />
      )}

      {finalizing && (
        <div className="grid min-h-40 place-items-center rounded-xl bg-emerald-50 p-6 ring-1 ring-emerald-200">
          <div className="text-center">
            <p className="font-medium text-emerald-950">Payment received</p>
            <p className="mt-1 text-sm text-emerald-900/70">Adding your credits…</p>
          </div>
        </div>
      )}

      {busy && !finalizing && !complete && (
        <p className="mt-2 text-sm text-black/60">Loading checkout…</p>
      )}

      {complete && (
        <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="font-medium">Payment complete ✓</p>
          {!error && (
            <p className="text-sm text-emerald-900/80">Your credits are available now.</p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{String(error)}</p>}
    </div>
  );
}
