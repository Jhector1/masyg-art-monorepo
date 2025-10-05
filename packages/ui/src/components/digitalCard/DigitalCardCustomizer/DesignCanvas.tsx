
// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/components/DesignCanvas.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React from "react";
import { DesignEl, EmojiEl, FaceKey, ImageEl, TextEl } from "./types";

interface DesignCanvasProps {
  face: FaceKey;
  label: string;
  layers: DesignEl[];
  activeFace: FaceKey;
  selectedId: string | null;
  designMode: boolean;
  startDragging: (e: React.PointerEvent, id: string, face: FaceKey) => void;
  setSelectedId: (id: string | null) => void;
  setActiveFace: (f: FaceKey) => void;
  onDoubleClick: (face: FaceKey, e: React.MouseEvent) => void;
  updateTextContent: (id: string, value: string) => void;
//    startDragging: (e: React.PointerEvent, id: string, face: FaceKey) => void;
  startResizing: (e: React.PointerEvent, id: string, face: FaceKey) => void; // ← add

}

export const DesignCanvas = React.forwardRef<HTMLDivElement, DesignCanvasProps>(
  function DesignCanvas(
    {
      face, label, layers, activeFace, selectedId, designMode,
      startDragging, setSelectedId, setActiveFace, onDoubleClick, updateTextContent,startResizing
    },
    ref
  ) {
    const list = layers.slice().sort((a, b) => a.z - b.z);
    return (
      <div
        ref={ref}
        className="design-canvas"
        onClick={(e) => { if (!designMode) return; e.stopPropagation(); setActiveFace(face); }}
        onDoubleClick={(e) => onDoubleClick(face, e)}
        onPointerDown={(e) => e.stopPropagation()}
      >
      <div className={`face-badge ${activeFace === face ? "active" : ""}`}>{label}</div>
      {list.map((el) => {
        const isSel = el.id === selectedId && face === activeFace;
        const commonStyle: React.CSSProperties = {
          left: `${el.xPct}%`,
          top: `${el.yPct}%`,
          transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale})`,
          opacity: el.opacity,
          zIndex: el.z,
        };

 if (el.type === "text") {
  const t = el as TextEl;
  const widthPct = t.boxWidthPct ?? 40;

  return (
    <div
      key={el.id}
      className={`design-el ${isSel ? "selected" : ""} text-el`}
      style={{
        ...commonStyle,
        width: `${widthPct}%`,          // ← fixed width relative to face
      }}
      onPointerDown={(e) => startDragging(e, el.id, face)}
      onClick={(e) => {
        if (!designMode) return;
        e.stopPropagation();
        setSelectedId(el.id);
        setActiveFace(face);
      }}
    >
      <div
        className="text-box"
        style={{
          width: "100%",                 // fill wrapper’s width
          fontFamily: t.fontFamily,
          fontSize: t.fontSize,
          fontWeight: t.fontWeight,
          fontStyle: t.fontStyle,
          color: t.color,
          textAlign: t.align as any,
          textShadow: t.shadow ? "0 2px 6px rgba(0,0,0,0.3)" : "none",
          background: t.bg ?? "transparent",
          padding: (t.pad ?? 0) + "px",
          borderRadius: 10,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
        contentEditable={designMode && isSel}
        suppressContentEditableWarning
        onBlur={(e) => updateTextContent(el.id, e.currentTarget.innerText)}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {t.text}
      </div>

      {/* resize handle – shown only when selected & in design mode */}
      {designMode && isSel && (
        <div
          className="resize-handle"
          onPointerDown={(e) => startResizing(e, el.id, face)}
          title="Drag to resize width"
        />
      )}
    </div>
  );
}


        if (el.type === "emoji") {
          const m = el as EmojiEl;
          return (
            <div
              key={el.id}
              className={`design-el ${isSel ? "selected" : ""}`}
              style={commonStyle}
              onPointerDown={(e) => startDragging(e, el.id, face)}
              onClick={(e) => { if (!designMode) return; e.stopPropagation(); setSelectedId(el.id); setActiveFace(face); }}
            >
              <div style={{ fontSize: m.fontSize, lineHeight: 1 }}>{m.emoji}</div>
            </div>
          );
        }

        const im = el as ImageEl;
        return (
          <div
            key={el.id}
            className={`design-el ${isSel ? "selected" : ""} image-el`}
            style={{ ...commonStyle, width: `${im.widthPct}%` }}
            onPointerDown={(e) => startDragging(e, el.id, face)}
            onClick={(e) => { if (!designMode) return; e.stopPropagation(); setSelectedId(el.id); setActiveFace(face); }}
          >
            <img src={im.url} alt="sticker" className="sticker-img" style={{ width: "100%", height: "auto", display: "block", borderRadius: 10 }} draggable={false} />
          </div>
        );
      })}
      </div>
    );
  }
);