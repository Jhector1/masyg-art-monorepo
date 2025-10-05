// File: src/lib/client/downloads.ts
"use client";

import { useState } from "react";

/** Normalize a human-friendly filename */
export function safeFilename(title: string, ext?: string) {
  const clean = (title || "artwork")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const dotExt = (ext || "file").toLowerCase().replace(/^\./, "");
  return `${clean || "artwork"}.${dotExt}`;
}

type ProgressCb = (fraction: number) => void;

/** Stream-fetch with progress; returns a Blob. */
async function fetchBlobWithProgress(url: string, onProgress?: ProgressCb) {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`Fetch failed (${res.status})`);

  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body.getReader();
 const chunks: ArrayBuffer[] = []
  let received = 0;

  // ReadableStream reader loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
          const ab = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    chunks.push(ab);
      received += value.length;
      if (onProgress && total > 0) onProgress(received / total);
    }
  }

const blob = new Blob(chunks, {
  type: res.headers.get("content-type") || "application/octet-stream",
});
  if (onProgress) onProgress(1);
  return blob;
}

/**
 * Download with progress. If CORS blocks, use same-origin proxy route.
 * Never opens a new tab.
 */
export async function downloadFile(
  url: string,
  filename: string,
  opts?: { onProgress?: ProgressCb; forceProxy?: boolean }
) {
  const { onProgress, forceProxy } = opts || {};

  async function save(blob: Blob) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  }

  async function tryDirect() {
    const blob = await fetchBlobWithProgress(url, onProgress);
    await save(blob);
  }

  async function viaProxy() {
    const proxy = `/api/downloads/proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const blob = await fetchBlobWithProgress(proxy, onProgress);
    await save(blob);
  }

  try {
    if (forceProxy) throw new Error("force-proxy");
    await tryDirect();
  } catch {
    // no tab open — just proxy it
    await viaProxy();
  }

  // fire-and-forget tracking
  fetch("/api/downloads", { method: "POST", credentials: "include" }).catch(() => {});
}

/** Shared hook: track which id is downloading + progress (0..1) */
export function useDownloader() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const set = (id: string, v: number) =>
    setProgress((m) => ({ ...m, [id]: Math.max(0, Math.min(1, v)) }));

  const clear = (id: string) =>
    setProgress((m) => {
      const { [id]: _, ...rest } = m;
      return rest;
    });

  const download = async (id: string, url: string, filename: string) => {
    setDownloadingId(id);
    try {
      await downloadFile(url, filename, {
        onProgress: (f) => set(id, f),
      });
    } finally {
      setDownloadingId(null);
      clear(id);
    }
  };

  return {
    downloadingId,
    progress, // map of id -> 0..1
    isDownloading: (id?: string) => (id ? downloadingId === id : downloadingId !== null),
    pct: (id: string) => Math.round((progress[id] ?? 0) * 100),
    download,
  };
}
