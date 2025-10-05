
// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/panels/BackgroundsPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React from "react";

interface BackgroundsPanelProps {
  frontOpacity: number; setFrontOpacity: (n: number) => void;
  backOpacity: number; setBackOpacity: (n: number) => void;
  inLeftOpacity: number; setInLeftOpacity: (n: number) => void;
  inRightOpacity: number; setInRightOpacity: (n: number) => void;
  upload: (e: React.ChangeEvent<HTMLInputElement>, which: "front"|"back"|"inLeft"|"inRight") => void;
}

export function BackgroundsPanel({ frontOpacity, setFrontOpacity, backOpacity, setBackOpacity, inLeftOpacity, setInLeftOpacity, inRightOpacity, setInRightOpacity, upload }: BackgroundsPanelProps) {
  return (
    <div className="rc-props">
      <div className="rc-card">
        <div className="rc-grvid flex-wrap flex justify-between">
          <label className="rc-field">
            <span>Outside Front</span>
            <input type="file" accept="image/*" onChange={(e) => upload(e, "front")} />
            <small>Opacity: {frontOpacity.toFixed(2)}</small>
            <input type="range" min={0} max={1} step={0.05} value={frontOpacity} onChange={(e) => setFrontOpacity(parseFloat(e.target.value))} />
          </label>
          <label className="rc-field">
            <span>Outside Back</span>
            <input type="file" accept="image/*" onChange={(e) => upload(e, "back")} />
            <small>Opacity: {backOpacity.toFixed(2)}</small>
            <input type="range" min={0} max={1} step={0.05} value={backOpacity} onChange={(e) => setBackOpacity(parseFloat(e.target.value))} />
          </label>
          <label className="rc-field">
            <span>Inside Left</span>
            <input type="file" accept="image/*" onChange={(e) => upload(e, "inLeft")} />
            <small>Opacity: {inLeftOpacity.toFixed(2)}</small>
            <input type="range" min={0} max={1} step={0.05} value={inLeftOpacity} onChange={(e) => setInLeftOpacity(parseFloat(e.target.value))} />
          </label>
          <label className="rc-field">
            <span>Inside Right</span>
            <input type="file" accept="image/*" onChange={(e) => upload(e, "inRight")} />
            <small>Opacity: {inRightOpacity.toFixed(2)}</small>
            <input type="range" min={0} max={1} step={0.05} value={inRightOpacity} onChange={(e) => setInRightOpacity(parseFloat(e.target.value))} />
          </label>
        </div>
      </div>
    </div>
  );
}
