// ───────────────────────────────────────────────────────────
// file: src/components/editor/hooks/useExportArtwork.ts
// ───────────────────────────────────────────────────────────
"use client";

import { useCallback, useState } from "react";
import type { ExportFormat, ExportMode, ExportUnit, StyleState } from "../types";

export function useExportArtwork(productId: string) {
  const [exporting, setExporting] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const [exportsLeft, setExportsLeft] = useState(0);
  const [purchased, setPurchased] = useState(false);
  const [purchasedDigital, setPurchasedDigital] = useState(false);

  const refreshExportStatus = useCallback(async (): Promise<boolean> => {
  try {
    const res = await fetch(
      `/api/products/${productId}/saveUserDesign/status`,
      { cache: "no-store" }
    );
    if (!res.ok) return false;

    const j = await res.json();

    // decide when we’re “ready” to stop retrying
    const ready =
      !!j.canExport ||
      !!j.purchased ||
      !!j.purchasedDigital ||
      (j.exportsLeft ?? 0) > 0;

    setCanExport(!!j.canExport);
    setPurchased(!!j.purchased);
    setExportsLeft(j.exportsLeft ?? 0);
    setPurchasedDigital(!!j.purchasedDigital);

    return ready;
  } catch {
    return false;
  }
}, [productId]);


  const quickDownloadPng = (canvas: HTMLCanvasElement | null, productId: string) => {
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `art-${productId}-${Date.now()}.png`;
    a.click();
  };

  const exportArtwork = async (
    format: ExportFormat,
    style: StyleState,
    defsMap: Record<string, string>,
    options: { mode: ExportMode; scale?: number; outW?: string; outH?: string; unit?: ExportUnit; dpi?: number; printW?: number; printH?: number; saveToLibrary?: boolean; }
  ) => {
    setExporting(true);
    try {
      const defsNow = Object.values(defsMap).join("\n");
      const sizePayload: any = {};

      if (options.mode === "scale") {
        sizePayload.scale = Math.max(0.05, Math.min(10, options.scale || 1));
      } else if (options.mode === "px") {
        const w = parseInt(options.outW || "", 10);
        const h = parseInt(options.outH || "", 10);
        if (Number.isFinite(w)) sizePayload.width = w;
        if (Number.isFinite(h)) sizePayload.height = h;
      } else if (options.mode === "print") {
        sizePayload.print = { unit: options.unit, width: options.printW, height: options.printH, dpi: options.dpi };
      }

      const res = await fetch(`/api/products/${productId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: { ...style, defs: defsNow },
          format,
          ...sizePayload,
          saveToLibrary: options.saveToLibrary,
          filename: `art-${productId}-${Date.now()}.${format === "jpg" ? "jpg" : format}`,
        }),
      });

      if (res.status === 401) throw new Error("Please sign in to save to your Library.");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Export failed");
      }

      // Download
      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as { url: string; id?: string };
        if (data.url && !options.saveToLibrary) {
          const dl = document.createElement("a");
          dl.href = data.url;
          dl.download = `art-${productId}.${format}`;
          dl.click();
        }
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `art-${productId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // ✅ Optimistic decrement (instant UI update)
      setExportsLeft(prev => {
        const next = Math.max(0, prev - 1);
        if (!purchased) setCanExport(next > 0);
        return next;
      });

      // 🔄 Reconcile with server (in case of race conditions)
      // Don't block the UI; fire and forget
      refreshExportStatus();
    } finally {
      setExporting(false);
    }
  };

  const fetchInitialExportStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/saveUserDesign/status`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      console.log(j)
      setCanExport(!!j.canExport);
      setPurchased(!!j.purchased);
      setExportsLeft(j.exportsLeft ?? 0);
          setPurchasedDigital(!!j.purchasedDigital);

    } catch {}
  }, [productId]);

  // (optional) export the refresher if you want to trigger it externally
  return {
    exporting,
    canExport,
    purchased,
    purchasedDigital,
    exportsLeft,
    quickDownloadPng,
    exportArtwork,
    fetchInitialExportStatus,
    refreshExportStatus, // ← expose if helpful
  };
}
