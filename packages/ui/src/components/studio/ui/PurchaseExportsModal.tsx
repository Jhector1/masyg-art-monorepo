// components/checkout/PurchaseExportsModal.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import EmbeddedQuotaCheckout from "../../orders/EmbeddedEditCredits";

type Pack = "10" | "50" | "200";

export default function PurchaseExportsModal({
  open,
  onClose,
  productId,
  busy,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  busy?: boolean;
  onApplied?: (exportsAdded: number) => void;
}) {
  const [step, setStep] = useState<"pick" | "pay">("pick");
  const [picked, setPicked] = useState<Pack | null>(null);

  useEffect(() => {
    if (!open) { setStep("pick"); setPicked(null); }
  }, [open]);

  const portalEl = useRef<HTMLElement | null>(null);
  useEffect(() => { portalEl.current = document.body; }, []);

  // lock body while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!portalEl.current) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        // ⬇️ overlay is now scrollable + safe-area padding
        <motion.div
          className="
            fixed inset-0 z-50
            bg-black/40 backdrop-blur-sm
            overflow-y-auto [webkit-overflow-scrolling:touch]
            px-3
            pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]
          "
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* ⬇️ dialog has max-height tied to viewport and can scroll */}
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="purchase-title"
            className="
              relative mx-auto w-full max-w-md rounded-2xl bg-white p-4
              shadow-xl ring-1 ring-black/10
            "
            style={{ maxHeight: "calc(100dvh - 48px)", overflowY: "auto" }}
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="purchase-title" className="text-base font-semibold">
                {step === "pick" ? "Buy more export quota" : "Complete your purchase"}
              </h3>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-black/60 hover:bg-zinc-100 hover:text-black/80"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {step === "pick" ? (
              <>
                <p className="mb-4 text-sm text-black/60">
                  Choose a pack. Usable on any format (PNG/JPG/WebP/TIFF/SVG).
                </p>
                <div className="grid gap-2">
                  {[
                    { key: "10" as Pack, label: "10 exports", price: "$3.99" },
                    { key: "50" as Pack, label: "50 exports", price: "$14.99" },
                    { key: "200" as Pack, label: "200 exports", price: "$39.99" },
                  ].map(({ key, label, price }) => (
                    <button
                      key={key}
                      disabled={!!busy}
                      onClick={() => { setPicked(key); setStep("pay"); }}
                      className={[
                        "flex items-center justify-between rounded-xl border px-3 py-3 text-sm",
                        "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
                        "focus:outline-none focus:ring-2 focus:ring-emerald-500",
                        busy ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-emerald-700">{price}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-black/50">
                  Purchases apply instantly. Unused exports don’t expire.
                </p>
              </>
            ) : (
              // ⬇️ wrapper gives the iframe a responsive min-height
              <div className="min-h-[clamp(480px,80dvh,720px)]">
                <EmbeddedQuotaCheckout
                  quota="export"
                  productId={productId}
                  packKey={picked ?? undefined}
                  open={open && step === "pay"}
                  onApplied={(n) => onApplied?.(n)}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalEl.current
  );
}
