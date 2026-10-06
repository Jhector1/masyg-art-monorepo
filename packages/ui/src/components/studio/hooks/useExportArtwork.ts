// ───────────────────────────────────────────────────────────
// file: src/components/editor/hooks/useExportArtwork.ts
// ───────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExportFormat, ExportMode, ExportUnit, StyleState } from "../types";

export type ExportStatusSnapshot = {
  canExport: boolean;
  purchased: boolean;
  purchasedDigital: boolean;
  purchasedPrint: boolean;
  exportsLeft: number;
};

export function useExportArtwork(productId: string) {
  const [exporting, setExporting] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const [exportsLeft, setExportsLeft] = useState(0);
  const [purchased, setPurchased] = useState(false);
  const [purchasedDigital, setPurchasedDigital] = useState(false);
  const [purchasedPrint, setPurchasedPrint] = useState(false);

  const applyStatus = useCallback((raw: any): ExportStatusSnapshot => {
    const snapshot: ExportStatusSnapshot = {
      canExport: !!raw?.canExport,
      purchased: !!raw?.purchased,
      purchasedDigital: !!raw?.purchasedDigital,
      purchasedPrint: !!raw?.purchasedPrint,
      exportsLeft: Math.max(0, Number(raw?.exportsLeft ?? 0) || 0),
    };

    setCanExport(snapshot.canExport);
    setPurchased(snapshot.purchased);
    setPurchasedDigital(snapshot.purchasedDigital);
    setPurchasedPrint(snapshot.purchasedPrint);
    setExportsLeft(snapshot.exportsLeft);

    return snapshot;
  }, []);

  const refreshExportStatus = useCallback(async (): Promise<ExportStatusSnapshot | null> => {
    try {
      const res = await fetch(
        `/api/user/products/${productId}/saveUserDesign/status`,
        {
          cache: "no-store",
          credentials: "include",
          headers: { "cache-control": "no-cache" },
        }
      );
      if (!res.ok) return null;
      return applyStatus(await res.json());
    } catch {
      return null;
    }
  }, [applyStatus, productId]);

  const waitForExportStatus = useCallback(
    async (
      predicate: (status: ExportStatusSnapshot) => boolean,
      options?: { tries?: number; delayMs?: number }
    ): Promise<ExportStatusSnapshot | null> => {
      const tries = Math.max(1, options?.tries ?? 20);
      const delayMs = Math.max(50, options?.delayMs ?? 300);

      for (let attempt = 0; attempt < tries; attempt += 1) {
        const status = await refreshExportStatus();
        if (status && predicate(status)) return status;
        if (attempt < tries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      return null;
    },
    [refreshExportStatus]
  );


  useEffect(() => {
    const refresh = () => {
      void refreshExportStatus();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshExportStatus]);

  const applyPurchasedExports = useCallback(
    (amount: number) => {
      const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
      if (safeAmount <= 0) return;

      setExportsLeft((current) => current + safeAmount);
      if (purchased) setCanExport(true);
    },
    [purchased]
  );

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
    options: {
      mode: ExportMode;
      scale?: number;
      outW?: string;
      outH?: string;
      unit?: ExportUnit;
      dpi?: number;
      printW?: number;
      printH?: number;
      saveToLibrary?: boolean;
    }
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
        sizePayload.print = {
          unit: options.unit,
          width: options.printW,
          height: options.printH,
          dpi: options.dpi,
        };
      }

      const res = await fetch(`/api/user/products/${productId}/export`, {
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

      setExportsLeft((current) => {
        const next = Math.max(0, current - 1);
        if (next === 0) setCanExport(false);
        return next;
      });

      void refreshExportStatus();
    } finally {
      setExporting(false);
    }
  };

  const fetchInitialExportStatus = useCallback(async () => {
    await refreshExportStatus();
  }, [refreshExportStatus]);

  return {
    exporting,
    canExport,
    purchased,
    purchasedDigital,
    purchasedPrint,
    exportsLeft,
    quickDownloadPng,
    exportArtwork,
    fetchInitialExportStatus,
    refreshExportStatus,
    waitForExportStatus,
    applyPurchasedExports,
  };
}
