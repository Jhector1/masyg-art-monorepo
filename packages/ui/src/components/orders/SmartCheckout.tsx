// components/orders/SmartCheckout.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { startEmbeddedCheckout, destroyEmbeddedCheckout } from "@acme/core/lib/embeddedCheckoutManager";
import { loadStripe } from "@stripe/stripe-js";

// Local type (we're NOT changing the manager)
type EmbeddedCtrl = { destroy: () => void; mount: (el: HTMLElement | string) => void };

export default function SmartCheckout({ cartProductList }: { cartProductList: any[] }) {
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<EmbeddedCtrl | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cartProductList }),
        });
        if (!res.ok) throw new Error("Failed to start checkout");
        const data = await res.json();

        if (data.flow === "redirect" && data.url) {
          window.location.href = data.url;
          return;
        }

        if (data.flow === "embedded" && data.clientSecret) {
          const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
          if (!stripe) throw new Error("Stripe failed to load");

          await startEmbeddedCheckout(
            // init: get controller
            (s) =>
              s.initEmbeddedCheckout({
                async fetchClientSecret() {
                  return data.clientSecret as string;
                },
                onComplete: () => {
                  destroyEmbeddedCheckout(ctrlRef.current || undefined);
                  ctrlRef.current = null;
                  // show toast / refresh, etc.
                },
              }),
            // mount: cast to local type that includes `mount`
            async (controller) => {
              if (cancelled) {
                try { (controller as any).destroy?.(); } catch {}
                return;
              }
              const el = containerRef.current || document.getElementById("embedded-checkout");
              if (!el) throw new Error("Mount container not found");

              const ec = controller as unknown as EmbeddedCtrl; // 👈 cast here
              ctrlRef.current = ec;
              ec.mount(el);
            }
          );
        } else {
          throw new Error("Unknown checkout flow");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Checkout failed");
      }
    })();

    return () => {
      cancelled = true;
      destroyEmbeddedCheckout(ctrlRef.current || undefined);
      ctrlRef.current = null;
    };
  }, [cartProductList]);

return (
  <div className="fixed inset-0 z-50 bg-black/40">
    {/* Scroll container */}
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-[560px] w-full p-4">
       
        <div
          id="embedded-checkout"
          ref={containerRef}
          className="min-h-[720px] bg-white rounded-2xl ring-1 ring-black/10"
        />
      </div>
    </div>
  </div>
);

}
