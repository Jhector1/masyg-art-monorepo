// src/components/shared/core/PrintCustomizerCore.tsx
"use client";
import React from "react";
import type { MaterialOption, FrameOption } from "@acme/core/types";

export default function PrintCustomizerCore({
  imageSrc,
  materials,
  frames,
  material,
  frame,
  onMaterial,
  onFrame,
  total,
  disabled,
  glazingOptions = [], glazing = "None", onGlazing,
  showGlazingSelector = false, showFrameSelector = true, allowUnframed = true,
}: {
  imageSrc: string;
  materials: MaterialOption[];
  frames: FrameOption[];
  material: MaterialOption;
  frame: FrameOption | null;
  onMaterial: (m: MaterialOption) => void;
  onFrame: (f: FrameOption | null) => void;
  total: number;
  disabled?: boolean;
  glazingOptions?: string[];
  glazing?: string;
  onGlazing?: (name:string)=>void;
  showGlazingSelector?: boolean;
  showFrameSelector?: boolean;
  allowUnframed?: boolean;
}) {
  // const [parsedFrameWidth, parsedFrameColor] = useMemo(() => {
  //   if (!frame?.border) return [0, "#000"];
  //   const parts = frame.border.split(" ");
  //   const widthPx = parseInt(parts[0], 10) || 0;
  //   const color = parts[2] || "#000";
  //   return [widthPx, color];
  // }, [frame]);

  return (
    <div className="p-4 sm:p-6 bg-white rounded-xl ring-1 ring-black/10 space-y-6">
      {/* Material Selector */}
      {materials.length>0&&<div>
        <h3 className="font-semibold mb-2">Material:</h3>
        <div className="flex flex-wrap gap-4">
          {materials.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onMaterial(m)}
              disabled={disabled}
              className={`p-2 border rounded-lg transition-shadow ${
                material.label === m.label ? "shadow-md border-purple-600" : "border-gray-300 hover:border-gray-400"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="w-16 h-16 relative">
                <img src={m.thumbnail} alt={m.label} className="object-cover rounded w-full h-full" />
              </div>
              <div className="mt-1 text-sm">{m.label}</div>
            </button>
          ))}
        </div>
      </div>}

      {/* Frame Selector */}
      {showFrameSelector&&<div>
        <h3 className="font-semibold mb-2">Frame:</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => onFrame(null)}
            disabled={disabled || !allowUnframed}
            className={`px-3 py-1 rounded ${frame === null ? "bg-purple-600 text-white" : "bg-gray-100"} ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            None
          </button>
          {frames.map((f) => (
            <button
              key={f.label}
              onClick={() => onFrame(f)}
              disabled={disabled}
              className={`px-3 py-1 rounded bg-cover bg-center bg-no-repeat ${
                f.label === "White" ? "text-black" : "text-white"
              } ${frame?.label === f.label ? "border-2 border-transparent outline outline-2 outline-purple-600 outline-offset-4" : ""} ${
                disabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
              style={{
                backgroundImage: `url("/images/textures/${f.label.split(" ")[0].trim().toLowerCase()}-wood.png")`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>}

      {showGlazingSelector&&<div>
        <h3 className="mb-2 font-semibold">Protective glazing:</h3>
        <div className="flex flex-wrap gap-2">
          {glazingOptions.map(choice=><button key={choice} type="button" disabled={disabled}
            onClick={()=>onGlazing?.(choice)} aria-pressed={choice.toLowerCase()===glazing.toLowerCase()}
            className={`rounded-lg border px-3 py-2 text-sm ${choice.toLowerCase()===glazing.toLowerCase()?"border-purple-600 bg-purple-600 text-white":"border-gray-300 bg-white hover:border-purple-400"}`}>{choice}</button>)}
          {!glazingOptions.length&&<p className="text-xs text-gray-600">No glazing combinations are offered for this edition.</p>}
        </div>
      </div>}

      {/* Preview (layered approximation, never payment authority) */}
      <div>
        <h3 className="font-semibold mb-2">Preview:</h3>
        <div className="relative w-full max-w-3xl aspect-[4/3] mx-auto grid place-items-center bg-gray-50 rounded-lg">
          <div className="relative max-w-[85%] max-h-[85%]" style={{padding:frame?"12px":"0",backgroundColor:frame?.label.toLowerCase().includes("white")?"#f6f5f1":frame?.label.toLowerCase().includes("oak")?"#b48d5e":frame?.label.toLowerCase().includes("walnut")?"#5b3828":frame?"#202124":"transparent",boxShadow:frame?"0 10px 22px rgba(0,0,0,.24)":"none"}}>
            {imageSrc?<img src={imageSrc} alt="Artwork with approximate framing and glazing" className="block max-h-[260px] max-w-full object-contain bg-white"/>:<div className="grid h-48 w-56 place-items-center bg-gray-100 text-xs text-gray-600">Upload a public artwork preview</div>}
            {glazing.toLowerCase()!=="none"&&<div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{background:glazing.toLowerCase().includes("non-glare")?"linear-gradient(135deg,rgba(255,255,255,.1),rgba(255,255,255,.03))":"linear-gradient(120deg,rgba(255,255,255,.3),rgba(255,255,255,0) 37%,rgba(255,255,255,.12) 70%,rgba(255,255,255,0))"}}/>}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">Visual simulation only—actual frame and glazing appearance may vary.</p>

      {/* Price */}
      {/* <div className="flex justify-between items-center">
        <span className="text-xl font-bold">Due: ${Number(total).toFixed(2)}</span>
      </div> */}
    </div>
  );
}
