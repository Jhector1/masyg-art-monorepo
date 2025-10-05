// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/panels/CardPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React from "react";
import { SketchPicker } from "react-color";

interface CardPanelProps {
  bgColor: string; setBgColor: (hex: string) => void;
  openAngle: number; setOpenAngle: (n: number) => void;
  bookTilt: number; setBookTilt: (n: number) => void;
}

export function CardPanel({ bgColor, setBgColor, openAngle, setOpenAngle, bookTilt, setBookTilt }: CardPanelProps) {
  return (
    <div className="rc-props">
      <div className="rc-card">
        <label className="rc-field">
          <span>Card Stock Color</span>
          <SketchPicker color={bgColor} onChangeComplete={(c) => setBgColor(c.hex)} />
        </label>
      </div>
      <div className="rc-card">
        <label className="rc-field">
          <span>Peek Open Angle: {openAngle}°</span>
          <input type="range" min={-170} max={-5} step={1} value={openAngle} onChange={(e) => setOpenAngle(parseInt(e.target.value, 10))} />
        </label>
        <label className="rc-field">
          <span>Outside Tilt (flipped): {bookTilt}°</span>
          <input type="range" min={140} max={180} step={1} value={bookTilt} onChange={(e) => setBookTilt(parseInt(e.target.value, 10))} />
        </label>
      </div>
    </div>
  );
}
