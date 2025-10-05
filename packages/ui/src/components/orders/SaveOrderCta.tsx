// components/SaveOrderCta.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import UniversalModal from "../modal/UniversalModal";
// 🔧 fix import: correct file & name

import { useUser } from "@acme/core/contexts/UserContext";
import { useRouter } from "next/navigation";
import AuthenticationForm from "../authenticate/AuthenticationFom";

export default function SaveOrderCta({ sessionId }: { sessionId: string }) {
  const { user } = useUser();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const tokenRef = useRef<string | null>(null);

  // Hide CTA if already claimed (reloads / multiple visits)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/orders/is-claimed?session_id=${sessionId}`, { credentials: "include" });
        const d = await r.json();
        if (d.claimed) setClaimed(true);
      } catch {}
    })();
  }, [sessionId]);

  const finishClaim = async () => {
    if (!tokenRef.current) return;
    try {
      const res = await fetch("/api/orders/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ claimToken: tokenRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      setClaimed(true);              // ✅ hide CTA now
      setOpen(false);
      toast.success("Order saved to your library.");
      // Optional: take them to the library or refresh
      // router.push("/account/orders");
      // router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not save order");
    }
  };

  const startClaim = async () => {
    try {
      setBusy(true);
      const res = await fetch("/api/orders/prepare-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start claim");

      if (data.alreadyClaimed) {
        setClaimed(true);            // ✅ immediately hide CTA
        toast.success("Already saved to your library.");
        return;
      }

      tokenRef.current = data.claimToken as string;

      if (user) {
        // ✅ already logged in → claim immediately (no modal)
        await finishClaim();
        return;
      }

      // guest → open auth modal, AuthenticationForm will call finishClaim via onSuccess
      setOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Could not start claim");
    } finally {
      setBusy(false);
    }
  };

  // ✅ If already claimed, replace CTA with a success note
  if (claimed) {
    return (
      <p className="mt-3 text-sm text-emerald-700">
        ✓ Saved to your Library.{" "}
        <button className="underline" onClick={() => router.push("/profile?tab=collections")}>
          Open Library
        </button>
      </p>
    );
  }

  // Logged-in view (shows only if not claimed)
  if (user) {
    return (
      <button
        disabled={busy}
        onClick={startClaim}
        className="mt-3 text-sm underline underline-offset-4"
      >
        Add to my library
      </button>
    );
  }

  // Guest view
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          disabled={busy}
          onClick={startClaim}
          className="px-4 py-2 rounded-full bg-black text-white hover:opacity-90"
        >
          Create account & save
        </button>
        <button
          disabled={busy}
          onClick={startClaim}
          className="px-4 py-2 rounded-full border"
        >
          Log in & save
        </button>
      </div>

      <UniversalModal isOpen={open} onClose={() => setOpen(false)}>
        <AuthenticationForm onSuccess={finishClaim} />
      </UniversalModal>
    </>
  );
}
