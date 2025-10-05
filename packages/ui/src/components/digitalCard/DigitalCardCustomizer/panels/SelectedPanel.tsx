
// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/panels/SelectedPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React from "react";
import { DesignEl, EmojiEl, ImageEl, TextEl } from "../types";
import { SketchPicker } from "react-color";

interface SelectedPanelProps {
  selected: DesignEl | null;
  bringFwd: () => void;
  sendBack: () => void;
  deleteSel: () => void;
  updateSelected: <K extends keyof DesignEl>(key: K, value: DesignEl[K]) => void;
  updateSelectedText: <K extends keyof TextEl>(key: K, value: TextEl[K]) => void;
  setLayersForEmojiSize: (id: string, size: number) => void;
  setLayersForEmojiChar: (id: string, value: string) => void;
  setLayersForImageWidth: (id: string, wp: number) => void;
}

export function SelectedPanel({ selected, bringFwd, sendBack, deleteSel, updateSelected, updateSelectedText, setLayersForEmojiSize, setLayersForEmojiChar, setLayersForImageWidth }: SelectedPanelProps) {
  if (!selected) {
    return (
      <div className="rc-props"><div className="rc-card"><small className="rc-hint">Select an element on the canvas to edit its properties.</small></div></div>
    );
  }
  return (
    <div className="rc-props">
      <div className="rc-card">
        <div className="rc-row">
          <button className="rc-btn" onClick={bringFwd}>Bring forward</button>
          <button className="rc-btn" onClick={sendBack}>Send back</button>
          <button className="rc-btn danger" onClick={deleteSel}>Delete</button>
        </div>
        <label className="rc-field">
          <span>Rotation: {Math.round(selected.rotation)}°</span>
          <input type="range" min={-180} max={180} step={1} value={selected.rotation} onChange={(e) => updateSelected("rotation", parseInt(e.target.value, 10))} />
        </label>
        <label className="rc-field">
          <span>Scale: {selected.scale.toFixed(2)}x</span>
          <input type="range" min={0.3} max={3} step={0.05} value={selected.scale} onChange={(e) => updateSelected("scale", parseFloat(e.target.value))} />
        </label>
        <label className="rc-field">
          <span>Opacity: {selected.opacity.toFixed(2)}</span>
          <input type="range" min={0.1} max={1} step={0.05} value={selected.opacity} onChange={(e) => updateSelected("opacity", parseFloat(e.target.value))} />
        </label>

        {selected.type === "text" && (
          <><label className="rc-field">
  <span>Box width: {(selected as TextEl).boxWidthPct ?? 40}%</span>
  <input
    type="range"
    min={8}
    max={100}
    step={1}
    value={(selected as TextEl).boxWidthPct ?? 40}
    onChange={(e) => updateSelectedText("boxWidthPct", parseInt(e.target.value, 10))}
  />
</label>

            <label className="rc-field">
              <span>Text</span>
              <input className="rc-input" value={(selected as TextEl).text} onChange={(e) => updateSelectedText("text", e.target.value)} />
            </label>
            <label className="rc-field">
              <span>Font family</span>
              <select className="rc-select" value={(selected as TextEl).fontFamily} onChange={(e) => updateSelectedText("fontFamily", e.target.value)}>
                <option>Inter, system-ui, sans-serif</option>
                <option>Georgia, serif</option>
                <option>Times New Roman, serif</option>
                <option>Great Vibes, cursive</option>
                <option>Arial, sans-serif</option>
              </select>
            </label>
            <label className="rc-field">
              <span>Font size: {(selected as TextEl).fontSize}px</span>
              <input type="range" min={12} max={96} step={1} value={(selected as TextEl).fontSize} onChange={(e) => updateSelectedText("fontSize", parseInt(e.target.value, 10))} />
            </label>
            <div className="rc-field">
              <span>Color</span>
              <SketchPicker color={(selected as TextEl).color} onChangeComplete={(c) => updateSelectedText("color", c.hex)} />
            </div>
            <div className="rc-row">
              <button className={`rc-btn ${(selected as TextEl).fontWeight >= 600 ? "is-on" : ""}`} onClick={() => updateSelectedText("fontWeight", (selected as TextEl).fontWeight >= 600 ? 400 : 700)}>B</button>
              <button className={`rc-btn ${(selected as TextEl).fontStyle === "italic" ? "is-on" : ""}`} onClick={() => updateSelectedText("fontStyle", (selected as TextEl).fontStyle === "italic" ? "normal" : "italic")}>i</button>
              <select className="rc-select" value={(selected as TextEl).align} onChange={(e) => updateSelectedText("align", e.target.value as TextEl["align"]) }>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <label className="rc-check">
                <input type="checkbox" checked={(selected as TextEl).shadow} onChange={(e) => updateSelectedText("shadow", e.target.checked)} />
                Shadow
              </label>
            </div>
            <div className="rc-row">
              <label className="rc-field small">
                <span>BG</span>
                <input type="color" value={(selected as TextEl).bg ?? "#ffffff"} onChange={(e) => updateSelectedText("bg", e.target.value)} />
              </label>
              <button className="rc-btn" onClick={() => updateSelectedText("bg", null)}>Clear BG</button>
            </div>
            <label className="rc-field">
              <span>Padding: {(selected as TextEl).pad ?? 0}px</span>
              <input type="range" min={0} max={24} step={1} value={(selected as TextEl).pad ?? 0} onChange={(e) => updateSelectedText("pad", parseInt(e.target.value, 10))} />
            </label>
          </>
        )}

        {selected.type === "emoji" && (
          <>
            <label className="rc-field">
              <span>Emoji</span>
              <input className="rc-input" value={(selected as EmojiEl).emoji} onChange={(e) => setLayersForEmojiChar(selected.id, e.target.value)} />
            </label>
            <label className="rc-field">
              <span>Size: {(selected as EmojiEl).fontSize}px</span>
              <input type="range" min={24} max={160} step={1} value={(selected as EmojiEl).fontSize} onChange={(e) => setLayersForEmojiSize(selected.id, parseInt(e.target.value, 10))} />
            </label>
          </>
        )}

        {selected.type === "image" && (
          <label className="rc-field">
            <span>Width: {(selected as ImageEl).widthPct}%</span>
            <input type="range" min={5} max={100} step={1} value={(selected as ImageEl).widthPct} onChange={(e) => setLayersForImageWidth(selected.id, parseInt(e.target.value, 10))} />
          </label>
        )}
      </div>
    </div>
  );
}

