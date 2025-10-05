// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/components/Toolbar.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React from "react";
import { FaceKey } from "./types";

interface ToolbarProps {
  designMode: boolean;
  setDesignMode: (f: (d: boolean) => boolean) => void;
  activeFace: FaceKey;
  setActiveFace: (f: FaceKey) => void;
  showFace: (f: FaceKey) => void;
  isOpen: boolean;
  setIsOpen: (f: (o: boolean) => boolean) => void;
  isFlipped: boolean;
  setIsFlipped: (f: (v: boolean) => boolean) => void;
  userScale: number;
  setUserScale: (v: number | ((z: number) => number)) => void;
  fit: () => void;
  onExport: () => void;
}

export function Toolbar({
  designMode,
  setDesignMode,
  activeFace,
  setActiveFace,
  showFace,
  isOpen,
  setIsOpen,
  isFlipped,
  setIsFlipped,
  userScale,
  setUserScale,
  fit,
  onExport,
}: ToolbarProps) {
  return (
    <div className="realistic-controls">
      <div className="rc-bar">
        <div className="rc-left">
          <button
            type="button"
            onClick={() => setDesignMode((d) => !d)}
            className={`rc-btn ${designMode ? "is-on" : ""}`}
            aria-pressed={designMode}
            title="Toggle design/edit mode"
          >
            {designMode ? "Design Mode" : "Preview"}
          </button>

          <div className="rc-seg">
            <label className="rc-label">Face</label>
            <select className="rc-select" value={activeFace} onChange={(e) => setActiveFace(e.target.value as FaceKey)}>
              <option value="front">Outside Front</option>
              <option value="back">Outside Back</option>
              <option value="inLeft">Inside Left</option>
              <option value="inRight">Inside Right</option>
            </select>
            <button className="rc-btn ghost" onClick={() => showFace(activeFace)} title="Show this face">View</button>
          </div>
        </div>

        <div className="rc-right">
          <div className="rc-zoom">
            <button className="rc-btn" onClick={() => setUserScale((z) => Math.max(0.5, +(Number(z) - 0.1).toFixed(2)))}>−</button>
            <div className="rc-zoom-bar">
              <input type="range" min={0.5} max={4} step={0.01} value={userScale} onChange={(e) => setUserScale(parseFloat(e.target.value))} />
              <span>{Math.round(userScale * 100)}%</span>
            </div>
            <button className="rc-btn" onClick={() => setUserScale((z) => Math.min(4, +(Number(z) + 0.1).toFixed(2)))}>+</button>
            <button className="rc-btn ghost" onClick={fit} title="Fit to width">Fit</button>
          </div>

          <button type="button" onClick={() => setIsOpen((o) => !o)} className="rc-btn" aria-pressed={isOpen} title="Peek the card open/closed">
            {isOpen ? "Close" : "Open"}
          </button>
          <button
            type="button"
            onClick={() => { setIsOpen(() => false); setIsFlipped((f) => !f); }}
            className="rc-btn ghost"
            aria-pressed={isFlipped}
            title="Flip outside/inside"
          >
            {isFlipped ? "Inside" : "Outside"}
          </button>
          <button type="button" onClick={onExport} className="rc-btn primary">Export PNG</button>
        </div>
      </div>
    </div>
  );
}
