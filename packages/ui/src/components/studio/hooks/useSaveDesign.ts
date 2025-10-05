"use client";

import { useState } from "react";
import type { StyleState } from "../types";
import toast from "react-hot-toast";

type SaveResp = {
  ok: boolean;
  designId?: string;
  previewUrl?: string | null;
  previewUpdatedAt?: string | null;
  purchased?: boolean;
  exportsLeft?: number;
  canExport?: boolean;
};

type SaveOpts = {
  previewDataUrl?: string;
  width?: number;
  quality?: number;
  endpoint?: "saveUserDesign" | "save"; // in case you keep the old name
};

export function useSaveDesign(productId: string) {
  const [saving, setSaving] = useState(false);

  const saveDesign = async (
    style: StyleState,
    defsMap: Record<string, string>,
    opts?: SaveOpts
  ): Promise<SaveResp> => {
    setSaving(true);
    try {
      const defsNow = Object.values(defsMap).join("\n");
      const endpoint = opts?.endpoint ?? "saveUserDesign";

      const res = await fetch(`/api/products/${productId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          style: { ...style, defs: defsNow },
          previewDataUrl: opts?.previewDataUrl,
          width: opts?.width ?? 800,
          quality: opts?.quality ?? 70,
        }),
      });

      if (res.status === 401) throw new Error("Please sign in to save.");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
          toast.success("Saved successfully!");

      return (await res.json()) as SaveResp;
    } finally {
      setSaving(false);
    }
  };

  return { saveDesign, saving, setSaving };
}
