"use client";

import { useState } from "react";

export function ConfirmButton({
  onConfirm,
  children,
  className = "",
  confirmText = "Are you sure?",
}: {
  onConfirm: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      className={`rounded-lg border px-3 py-1.5 text-sm hover:bg-muted ${className}`}
      disabled={busy}
      onClick={async () => {
        if (!confirm(confirmText)) return;
        try {
          setBusy(true);
          await onConfirm();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "..." : children}
    </button>
  );
}
