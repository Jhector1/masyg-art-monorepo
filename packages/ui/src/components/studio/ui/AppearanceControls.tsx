// src/components/editor/ui/AppearanceControls.tsx
"use client";

import React from "react";
import { useDesignContext } from "../contexts/DesignContext";
import { colorInputValue } from "../utils/colorInputValue"; // keep your helper

export default function AppearanceControls() {
  const {
    style,
    handleStyleChange,
    beginHistory,
    commitHistory,
    // ⬇️ Provide one of these from your DesignContext (initial, base, etc.)
    initialStyle, // if your context uses "baseStyle", rename accordingly
  } = useDesignContext() as any;

  const start = (label: string) => () => beginHistory(label);
  const commit = (label: string) => () => commitHistory(label);

  const applyBase = (
    key: "fillColor" | "strokeColor" | "backgroundColor",
    baseVal: string | undefined,
    label: string
  ) => {
    // Guard: fall back to current value if base isn't available
    const next = baseVal ?? (style as any)[key];
    beginHistory(`${label} (base)`);
    handleStyleChange(key, next);
    commitHistory(`${label} (base)`);
  };

  // Helpers to get base colors safely (use whatever your context provides)
  const baseFill = initialStyle?.fillColor;
  const baseStroke = initialStyle?.strokeColor;
  const baseBg = initialStyle?.backgroundColor;

  return (
    <div id="controls-panel">
      {/* ————— Fill ————— */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-black/60">Fill</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorInputValue(style.fillColor)}
            onChange={(e) => {
              handleStyleChange("fillColor", e.target.value);
              commitHistory("Fill color");
            }}
            className="h-10 flex-1 rounded-md border border-black/10"
          />
          <button
            type="button"
            onClick={() => applyBase("fillColor", baseFill, "Fill color")}
            className="shrink-0 rounded-md border border-black/10 px-2 py-1 hover:bg-black/5"
            title="Use base (original) fill color"
          >
            Use base
          </button>
        </div>
      </label>

      {/* ————— Stroke ————— */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-black/60">Stroke</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorInputValue(style.strokeColor)}
            onChange={(e) => {
              handleStyleChange("strokeColor", e.target.value);
              commitHistory("Stroke color");
            }}
            className="h-10 flex-1 rounded-md border border-black/10"
          />
          <button
            type="button"
            onClick={() => applyBase("strokeColor", baseStroke, "Stroke color")}
            className="shrink-0 rounded-md border border-black/10 px-2 py-1 hover:bg-black/5"
            title="Use base (original) stroke color"
          >
            Use base
          </button>
        </div>
      </label>

      {/* ————— Background ————— */}
      <label className="col-span-2 flex flex-col gap-1 text-xs">
        <span className="text-black/60">Background</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorInputValue(style.backgroundColor)}
            onChange={(e) => {
              handleStyleChange("backgroundColor", e.target.value);
              commitHistory("Background color");
            }}
            className="h-10 flex-1 rounded-md border border-black/10"
          />
          <button
            type="button"
            onClick={() =>
              applyBase("backgroundColor", baseBg, "Background color")
            }
            className="shrink-0 rounded-md border border-black/10 px-2 py-1 hover:bg-black/5"
            title="Use base (original) background color"
          >
            Use base
          </button>
        </div>
      </label>

      {/* ————— Stroke Width ————— */}
      <label className="col-span-2 flex items-center gap-3 text-xs">
        <span className="w-24 text-black/60">Stroke Width</span>
        <input
          type="range"
          min={0}
          max={16}
          step={0.5}
          value={style.strokeWidth ?? 0}
          onPointerDown={start("Stroke width")}
          onChange={(e) =>
            handleStyleChange("strokeWidth", parseFloat(e.target.value))
          }
          onPointerUp={commit("Stroke width")}
          className="w-full"
        />
        <span className="w-12 text-right tabular-nums">
          {(style.strokeWidth ?? 0).toString()}
        </span>
      </label>

   {/* ————— Opacities ————— */}
<label className="flex items-center gap-3 text-xs">
  <span className="w-24 text-black/60">Fill Opacity</span>
  <input
    type="range"
    min={0}
    max={1}
    step={0.01}
    value={style.fillOpacity ?? 1}
    onPointerDown={start("Fill opacity")}
    onChange={(e) => handleStyleChange("fillOpacity", parseFloat(e.target.value))}
    onPointerUp={commit("Fill opacity")}
    className="w-full"
  />
  <span className="w-12 text-right tabular-nums">
    {(style.fillOpacity ?? 1).toFixed(2)}
  </span>
</label>

<label className="flex items-center gap-3 text-xs">
  <span className="w-24 text-black/60">Stroke Opacity</span>
  <input
    type="range"
    min={0}
    max={1}
    step={0.01}
    value={style.strokeOpacity ?? 1}
    onPointerDown={start("Stroke opacity")}
    onChange={(e) => handleStyleChange("strokeOpacity", parseFloat(e.target.value))}
    onPointerUp={commit("Stroke opacity")}
    className="w-full"
  />
  <span className="w-12 text-right tabular-nums">
    {(style.strokeOpacity ?? 1).toFixed(2)}
  </span>
</label>

<label className="flex items-center gap-3 text-xs">
  <span className="w-24 text-black/60">Background Opacity</span>
  <input
    type="range"
    min={0}
    max={1}
    step={0.01}
    value={style.backgroundOpacity ?? 1}    
    onPointerDown={start("Background opacity")}
    onChange={(e) => handleStyleChange("backgroundOpacity", parseFloat(e.target.value))}
    onPointerUp={commit("Background opacity")}
    className="w-full"
  />
  <span className="w-12 text-right tabular-nums">
    {(style.backgroundOpacity ?? 1).toFixed(2)}
  </span>
</label>


      {/* Add similar sliders for strokeOpacity, backgroundOpacity if needed */}
    </div>
  );
}
