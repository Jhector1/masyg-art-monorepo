// components/CheckoutHost.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";

/* ---------- Types for our custom window events ---------- */
type OpenCheckoutDetail = {
  clientSecret: string;
  exportHref?: string;
  onPurchaseComplete?: () => void;
};
declare global {
  interface WindowEventMap {
    "open-checkout": CustomEvent<OpenCheckoutDetail>;
    "checkout-complete": CustomEvent<void>;
    "checkout-error": CustomEvent<void>;
    "checkout-abort": CustomEvent<void>;
  }
}

/* ---------- Cache Stripe at module scope (no re-loads) ---------- */
const stripePromise = (() => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  return key ? loadStripe(key) : Promise.resolve(null as unknown as Stripe | null);
})();

/* ---------- Minimal toast (unchanged) ---------- */
function showThankYouToast(
  message: string,
  action?: { label: string; onClick: () => void }
) {
  try {
    const id = "checkout-thanks";
    document.getElementById(id)?.remove();
    const root = document.createElement("div");
    root.id = id;
    Object.assign(root.style, {
      position: "fixed",
      left: "50%",
      bottom: "16px",
      transform: "translateX(-50%)",
      zIndex: "9999",
    });
    const card = document.createElement("div");
    Object.assign(card.style, {
      display: "flex",
      gap: "10px",
      alignItems: "center",
      padding: "10px 14px",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.98)",
      boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
      border: "1px solid rgba(0,0,0,0.06)",
      fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
    });
    const text = document.createElement("span");
    text.textContent = message;
    Object.assign(text.style, { fontSize: "14px", color: "#111827" });
    card.appendChild(text);
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      Object.assign(btn.style, {
        fontSize: "13px",
        padding: "6px 10px",
        borderRadius: "999px",
        border: "1px solid rgba(99,102,241,0.25)",
        background: "#eef2ff",
        color: "#3730a3",
        cursor: "pointer",
      });
      btn.addEventListener("click", () => {
        try { action.onClick(); } finally { root.remove(); }
      });
      card.appendChild(btn);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    Object.assign(close.style, {
      fontSize: "16px", padding: "4px 6px", color: "#6b7280",
      background: "transparent", border: "none", cursor: "pointer",
    });
    close.addEventListener("click", () => root.remove());
    card.appendChild(close);
    root.appendChild(card);
    document.body.appendChild(root);
    setTimeout(() => root.remove(), 7000);
  } catch {}
}

/* ---------- Host ---------- */
export default function CheckoutHost() {
  const [detail, setDetail] = useState<OpenCheckoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<{ destroy: () => void } | null>(null);
  const openingRef = useRef(false); // prevent duplicate opens while mounting

  // Listen once, globally
  useEffect(() => {
    const onOpen = (e: WindowEventMap["open-checkout"]) => {
      if (openingRef.current || detail) {
        // If already open with the same secret, ignore; otherwise replace
        if (detail?.clientSecret === e.detail.clientSecret) return;
      }
      setDetail(e.detail);
    };
    window.addEventListener("open-checkout", onOpen);
    return () => window.removeEventListener("open-checkout", onOpen);
  }, [detail]);

  // Body scroll lock
  useEffect(() => {
    if (!detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [detail]);

  // Esc to close
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay("esc");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  // Mount embedded checkout
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!detail) return;
      openingRef.current = true;
      setError(null);

      // wait a frame so the DOM overlay & container are present
      await new Promise((r) => requestAnimationFrame(r));

      const stripe = await stripePromise;
      if (!stripe) {
        window.dispatchEvent(new CustomEvent("checkout-error"));
        setError("Stripe failed to load.");
        openingRef.current = false;
        return;
      }

      // Tear down any previous controller
      try { controllerRef.current?.destroy?.(); } catch {}
      controllerRef.current = null;

      // Safety: container could be gone if user closed quickly
      if (cancelled || !containerRef.current) {
        openingRef.current = false;
        return;
      }

      const controller = await stripe.initEmbeddedCheckout({
        async fetchClientSecret() {
          return detail.clientSecret;
        },
        onComplete: () => {
          safeDestroy();
          window.dispatchEvent(new CustomEvent("checkout-complete"));
          showThankYouToast(
            "Thank you for your purchase! You can now export this design.",
            detail.exportHref
              ? { label: "Open Library", onClick: () => (window.location.href = detail.exportHref!) }
              : undefined
          );
          try { detail.onPurchaseComplete?.(); } catch {}
        },
      });

      if (cancelled) {
        try { controller.destroy(); } catch {}
        window.dispatchEvent(new CustomEvent("checkout-abort"));
        openingRef.current = false;
        return;
      }

      controllerRef.current = controller;
      // Guard: container might be null if overlay closed very fast
      if (containerRef.current) {
        controller.mount(containerRef.current);
      } else {
        try { controller.destroy(); } catch {}
      }

      openingRef.current = false;
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  function safeDestroy() {
    try { controllerRef.current?.destroy?.(); } catch {}
    controllerRef.current = null;
    setDetail(null);
  }

  function closeOverlay(_reason: "backdrop" | "esc" | "button" = "backdrop") {
    safeDestroy();
  }

  if (!detail) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // close on outside mousedown for more reliable backdrop behavior
        if (e.target === e.currentTarget) closeOverlay("backdrop");
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,.45)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "24px 12px",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
          maxHeight: "calc(100dvh - 48px)",
          overflowY: "auto",
        }}
      >
        <div ref={containerRef} style={{ minHeight: 620 }} />
        {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>⚠️ {error}</p>}
      </div>
    </div>
  );
}
