// File: src/components/admin/ProductAssetsTable.tsx
"use client";

import type { ProductAsset } from "@prisma/client";
import * as React from "react";

export default function ProductAssetsTable({ assets }: { assets: ProductAsset[] }) {
  if (!assets.length) return <div className="text-sm text-neutral-500">No deliverables yet.</div>;

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-neutral-50 text-left">
          <tr className="text-neutral-700">
            <th className="p-3">Preview</th>
            <th className="p-3">Type</th>
            <th className="p-3">Ext</th>
            <th className="p-3">Dimensions</th>
            <th className="p-3">Size</th>
            <th className="p-3">URL</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="align-top odd:bg-white even:bg-neutral-50/40">
              <td className="p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl ?? a.url} alt="" className="h-20 w-28 rounded object-cover ring-1 ring-inset ring-neutral-200" />
              </td>
              <td className="p-3"><Badge>{a.resourceType ?? "image"}</Badge></td>
              <td className="p-3"><Badge>{a.ext}</Badge></td>
              <td className="p-3">{a.width && a.height ? `${a.width}×${a.height}` : "—"}</td>
              <td className="p-3">{a.sizeBytes ? prettyBytes(a.sizeBytes) : "—"}</td>
              <td className="p-3 break-all">
                <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  {a.url}
                </a>
              </td>
              <td className="p-3">
                <button
                  onClick={() => copy(a.url)}
                  className="rounded-lg border px-2 py-1 text-xs hover:bg-neutral-50"
                  title="Copy URL"
                >
                  Copy
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] leading-5 text-neutral-700">
      {children}
    </span>
  );
}

function prettyBytes(n: number) {
  const u = ["B", "KB", "MB", "GB"]; let i = 0; let v = n; while (v >= 1024 && i < u.length - 1) { v = v / 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}