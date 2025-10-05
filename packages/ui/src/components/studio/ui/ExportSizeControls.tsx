// ───────────────────────────────────────────────────────────
// file: src/components/editor/ui/ExportSizeControls.tsx
// ───────────────────────────────────────────────────────────
"use client";

import React from "react";
import type { ExportMode, ExportUnit } from "../types";

interface Props {
  mode: ExportMode;
  setMode: (m: ExportMode) => void;
  baseW: number;
  baseH: number;
  scale: number;
  setScale: (v: number) => void;
  outW: string;
  setOutW: (v: string) => void;
  outH: string;
  setOutH: (v: string) => void;
  unit: ExportUnit;
  setUnit: (u: ExportUnit) => void;
  dpi: number;
  setDpi: (v: number) => void;
  printW: number;
  setPrintW: (v: number) => void;
  printH: number;
  setPrintH: (v: number) => void;
}

export default function ExportSizeControls(props: Props) {
  const { mode, setMode, baseW, baseH, scale, setScale, outW, setOutW, outH, setOutH, unit, setUnit, dpi, setDpi, printW, setPrintW, printH, setPrintH } = props;

  return (
    <div className="mt-4">
      <h2 className="mb-3 text-sm font-semibold text-black/70">Export size</h2>
      <div className="mb-2 flex gap-1 rounded-xl bg-white ring-1 ring-black/10 p-1 overflow-x-auto">
        {["scale", "px", "print"].map((m) => (
          <button key={m} onClick={() => setMode(m as any)} className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap ${mode === m ? "bg-emerald-100 text-emerald-900" : "hover:bg-emerald-50"}`}>{m === "px" ? "Pixels" : (m as string)[0].toUpperCase() + (m as string).slice(1)}</button>
        ))}
      </div>

      {mode === "scale" && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-16 text-black/60">Scale</span>
            <input type="range" min={0.25} max={4} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full" />
            <span className="w-14 text-right tabular-nums">{(scale * 100).toFixed(0)}%</span>
          </div>
          <div className="text-black/60">Base: {baseW}×{baseH}px → Export: {Math.round(baseW * scale)}×{Math.round(baseH * scale)}px</div>
        </div>
      )}

      {mode === "px" && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-black/60">Width (px)</span>
            <input className="h-9 rounded-md border border-black/10 px-2" value={outW} onChange={(e) => setOutW(e.target.value.replace(/[^\d]/g, ""))} placeholder={String(baseW)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-black/60">Height (px)</span>
            <input className="h-9 rounded-md border border-black/10 px-2" value={outH} onChange={(e) => setOutH(e.target.value.replace(/[^\d]/g, ""))} placeholder={String(baseH)} />
          </label>
          <div className="col-span-2 text-black/50">Tip: leave one side empty to keep aspect ratio (server will fit).</div>
        </div>
      )}

      {mode === "print" && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="flex flex-col gap-1 col-span-1">
            <span className="text-black/60">Unit</span>
            <select className="h-9 rounded-md border border-black/10 px-2" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
              <option value="in">in</option>
              <option value="mm">mm</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-black/60">Width</span>
            <input className="h-9 rounded-md border border-black/10 px-2" type="number" step="0.1" value={printW} onChange={(e) => setPrintW(parseFloat(e.target.value) || 0)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-black/60">Height</span>
            <input className="h-9 rounded-md border border-black/10 px-2" type="number" step="0.1" value={printH} onChange={(e) => setPrintH(parseFloat(e.target.value) || 0)} />
          </label>
          <label className="flex flex-col gap-1 col-span-3">
            <span className="text-black/60">DPI</span>
            <input className="h-9 rounded-md border border-black/10 px-2" type="number" step="1" value={dpi} onChange={(e) => setDpi(parseInt(e.target.value) || 300)} />
          </label>
          <div className="col-span-3 text-black/50">
            Output ≈ {unit === "mm" ? Math.round((printW / 25.4) * dpi) : Math.round(printW * dpi)}×{unit === "mm" ? Math.round((printH / 25.4) * dpi) : Math.round(printH * dpi)} px
          </div>
        </div>
      )}
    </div>
  );
}
