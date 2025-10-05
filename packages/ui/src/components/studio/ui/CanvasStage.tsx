// src/components/editor/ui/CanvasStage.tsx
"use client";

import React, { forwardRef, useEffect, useRef, useState } from "react";

type Props = {
  zoom: number;
  setZoom: (z: number | ((z: number) => number)) => void;
  loading: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CanvasStage = forwardRef<HTMLCanvasElement, Props>(({ zoom, setZoom, loading }, ref) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Clamp panning so the image never leaves the viewport completely
  const clampPan = (x: number, y: number) => {
    const wrap = wrapperRef.current;
    const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
    if (!wrap || !canvas) return { x, y };

    const viewW = wrap.clientWidth;
    const viewH = wrap.clientHeight;

    // Canvas CSS size BEFORE transform (zoom doesn’t affect clientWidth/Height)
    const baseW = canvas.clientWidth || canvas.width;
    const baseH = canvas.clientHeight || canvas.height;

    const scaledW = baseW * zoom;
    const scaledH = baseH * zoom;

    // If the scaled image is smaller than viewport, keep centered (pan = 0)
    if (scaledW <= viewW) x = 0;
    if (scaledH <= viewH) y = 0;

    // Otherwise allow panning within half of the overflow in each direction
    const maxX = Math.max(0, (scaledW - viewW) / 2);
    const maxY = Math.max(0, (scaledH - viewH) / 2);

    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  // Re-clamp whenever zoom or wrapper size changes
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setPan((p) => clampPan(p.x, p.y));
    });
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only pan when zoomed in
    if (zoom <= 1) return;
    const wrap = wrapperRef.current;
    if (!wrap) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    startRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const nx = startRef.current.panX + dx;
    const ny = startRef.current.panY + dy;
    setPan(clampPan(nx, ny));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Optional: ctrl/⌘+wheel zoom at cursor (with clamped pan)
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    const withModifier = e.ctrlKey || e.metaKey;
    if (!withModifier) return; // let page scroll normally
    e.preventDefault();

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = clamp(+(zoom * factor).toFixed(3), 0.25, 5);

    // Zoom around cursor → adjust pan so the point under the cursor stays put
    const wrap = wrapperRef.current;
    const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
    if (!wrap || !canvas) return setZoom(newZoom);

    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;  // cursor from center
    const cy = e.clientY - rect.top - rect.height / 2;

    // How much scale changed
    const k = newZoom / zoom;

    // Adjust pan by the amount the content would “move” under the cursor
    const nx = k * (pan.x - cx) + cx;
    const ny = k * (pan.y - cy) + cy;

    setZoom(newZoom);
    const clamped = clampPan(nx, ny);
    // apply on next frame to use latest zoom in clamp
    requestAnimationFrame(() => setPan(clamped));
  };

  // Reset pan when fully zoomed out
  useEffect(() => {
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  return (
    <div className="relative rounded-2xl bg-white p-3 ring-1 ring-black/5">
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm text-black/70">Zoom</label>
        <input
          type="range"
          min={0.25}
          max={5}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-full"
          aria-label="Zoom"
        />
        <span className="sm:w-14 text-right tabular-nums text-xs text-black/60">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <div
        ref={wrapperRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className={[
          "relative grid place-items-center rounded-xl p-2 sm:p-4",
          "bg-[conic-gradient(at_20%_20%,#fafafa,#f4f4f5)]",
          "max-h-[70vh] md:max-h-[72vh]",
          "overflow-hidden select-none touch-none", // hide scrollbars; use drag
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : "",
        ].join(" ")}
        aria-busy={loading}
      >
        <canvas
          ref={ref}
          className="max-w-full h-auto xl:h-70vh shadow-sm ring-1 ring-black/5 will-change-transform"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        />

        {loading && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/60 backdrop-blur-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
});

CanvasStage.displayName = "CanvasStage";
export default CanvasStage;
