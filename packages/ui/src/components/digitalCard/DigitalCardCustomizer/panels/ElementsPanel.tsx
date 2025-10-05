
// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/panels/ElementsPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React from "react";

interface ElementsPanelProps {
  addText: () => void;
  addEmoji: (emoji?: string) => void;
  addStickerImage: (file: File) => void;
}

export function ElementsPanel({ addText, addEmoji, addStickerImage }: ElementsPanelProps) {
  return (
    <div className="rc-props">
      <div className="rc-card">
        <div className="rc-row">
          <button className="rc-btn primary" onClick={addText}>+ Text</button>
          <button className="rc-btn" onClick={() => addEmoji("🎂")}>+ Emoji</button>
          <label className="rc-btn ghost cursor-pointer">
            + Sticker
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addStickerImage(f); e.currentTarget.value = ""; }} />
          </label>
        </div>
        <small className="rc-hint">Double-click a face to drop a text box at cursor.</small>
      </div>
    </div>
  );
}
