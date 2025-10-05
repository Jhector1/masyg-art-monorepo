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
      <div>
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
      </div>

      {/* Frame Selector */}
      <div>
        <h3 className="font-semibold mb-2">Frame:</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => onFrame(null)}
            disabled={disabled}
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
      </div>

      {/* Preview (super simple) */}
      <div>
        <h3 className="font-semibold mb-2">Preview:</h3>
        <div className="relative w-full max-w-3xl aspect-[4/3] mx-auto grid place-items-center bg-gray-50 rounded-lg">
          <img src={imageSrc} alt="Artwork" className="max-h-[70%] rounded shadow" />
        </div>
      </div>

      {/* Price */}
      {/* <div className="flex justify-between items-center">
        <span className="text-xl font-bold">Due: ${Number(total).toFixed(2)}</span>
      </div> */}
    </div>
  );
}
