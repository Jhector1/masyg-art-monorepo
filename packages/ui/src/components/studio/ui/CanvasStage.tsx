// src/components/editor/ui/CanvasStage.tsx
"use client";

import React, { forwardRef, useEffect, useRef, useState } from "react";

type Props = {
  zoom: number;
  setZoom: (z: number | ((z: number) => number)) => void;
  loading: boolean;
};

type Point = { x: number; y: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const EPS = 1e-3;

const CanvasStage = forwardRef<HTMLCanvasElement, Props>(
  ({ zoom, setZoom, loading }, ref) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

    // Interaction flags/state
    const hasInteractedRef = useRef(false);
    const draggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    // Inertia
    const lastMoveRef = useRef({ t: 0, x: 0, y: 0 });
    const velocityRef = useRef({ vx: 0, vy: 0 });
    const inertiaRAF = useRef<number | null>(null);

    // Pinch state
    const pointers = useRef<Map<number, Point>>(new Map());
    const pinchStart = useRef({
      zoom: 1,
      panX: 0,
      panY: 0,
      mid: { x: 0, y: 0 },
      dist: 1,
    });

    // Cache last dimensions used for fit (prevents refit loops)
    const lastFitDims = useRef<{
      viewW: number; viewH: number; baseW: number; baseH: number
    } | null>(null);

    // Sizes (untransformed CSS px)
    const getViewAndBase = () => {
      const wrap = wrapperRef.current;
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!wrap || !canvas) return null;

      const viewW = wrap.clientWidth || 1;
      const viewH = wrap.clientHeight || 1;

      // Unaffected by CSS transforms:
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const baseW = canvas.offsetWidth  || (canvas.width  ? canvas.width  / dpr : 1);
      const baseH = canvas.offsetHeight || (canvas.height ? canvas.height / dpr : 1);

      return { wrap, canvas, viewW, viewH, baseW, baseH, dpr };
    };

    // Drag-anywhere clamp (even when smaller than viewport)
    const clampPan = (x: number, y: number) => {
      const dims = getViewAndBase();
      if (!dims) return { x, y };
      const { viewW, viewH, baseW, baseH } = dims;

      const scaledW = baseW * zoom;
      const scaledH = baseH * zoom;

      // If content is smaller, allow at least half viewport of slack
      const halfOverflowX = Math.max((scaledW - viewW) / 2, viewW / 2);
      const halfOverflowY = Math.max((scaledH - viewH) / 2, viewH / 2);

      return {
        x: clamp(x, -halfOverflowX, halfOverflowX),
        y: clamp(y, -halfOverflowY, halfOverflowY),
      };
    };

    // Fit-to-view (contain) with tiny padding; guarded to avoid loops
    const fitToView = (pad = 0.995) => {
      const dims = getViewAndBase();
      if (!dims) return;
      const { viewW, viewH, baseW, baseH } = dims;

      const contain = Math.min(viewW / baseW, viewH / baseH) * pad;
      const nextZoom = clamp(+contain.toFixed(3), 0.05, 10);

      const zoomChanged = Math.abs(nextZoom - zoom) >= EPS;
      const panChanged = Math.abs(pan.x) >= EPS || Math.abs(pan.y) >= EPS;

      if (!zoomChanged && !panChanged) return; // no-op to prevent ping-pong

      if (zoomChanged) setZoom(nextZoom);
      if (panChanged) setPan({ x: 0, y: 0 });
    };

    // Compare rounded ints to ignore subpixel noise
    const dimsChanged = () => {
      const d = getViewAndBase();
      if (!d) return false;
      const key = {
        viewW: Math.round(d.viewW),
        viewH: Math.round(d.viewH),
        baseW: Math.round(d.baseW),
        baseH: Math.round(d.baseH),
      };
      const prev = lastFitDims.current;
      const changed =
        !prev ||
        prev.viewW !== key.viewW ||
        prev.viewH !== key.viewH ||
        prev.baseW !== key.baseW ||
        prev.baseH !== key.baseH;
      if (changed) lastFitDims.current = key;
      return changed;
    };

    // Debounced schedule for fitting
    let fitRaf: number | null = null;
    const scheduleFit = () => {
      if (fitRaf) cancelAnimationFrame(fitRaf);
      fitRaf = requestAnimationFrame(() => {
        fitRaf = null;
        if (!hasInteractedRef.current && dimsChanged()) fitToView();
      });
    };

    // Initial fit
    useEffect(() => {
      const id = requestAnimationFrame(() => fitToView());
      return () => cancelAnimationFrame(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Canvas size observers (no 'style'!)
    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!canvas) return;

      const ro = new ResizeObserver(() => scheduleFit());
      ro.observe(canvas);

      const mo = new MutationObserver(() => scheduleFit());
      mo.observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });

      return () => {
        ro.disconnect();
        mo.disconnect();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Wrapper resize observer
    useEffect(() => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const ro = new ResizeObserver(() => {
        if (!hasInteractedRef.current) scheduleFit();
        else setPan((p) => clampPan(p.x, p.y));
      });
      ro.observe(wrap);
      return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep pan valid when zoom changes
    useEffect(() => {
      setPan((p) => clampPan(p.x, p.y));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom]);

    // Inertia helpers
    const stopInertia = () => {
      if (inertiaRAF.current != null) {
        cancelAnimationFrame(inertiaRAF.current);
        inertiaRAF.current = null;
      }
    };

    const startInertia = () => {
      const decay = 0.0025;
      const maxMs = 800;
      const start = performance.now();
      const startPan = { ...pan };
      const { vx, vy } = velocityRef.current;

      const step = () => {
        const t = performance.now();
        const elapsed = t - start;
        if (elapsed > maxMs) return;

        const f = Math.exp(-decay * elapsed);
        const dx = vx * 100 * f;
        const dy = vy * 100 * f;

        const nx = startPan.x + dx;
        const ny = startPan.y + dy;

        const clamped = clampPan(nx, ny);
        setPan(clamped);

        if (Math.hypot(dx, dy) < 0.1) return;
        inertiaRAF.current = requestAnimationFrame(step);
      };

      inertiaRAF.current = requestAnimationFrame(step);
    };

    // Pointer handlers (drag + pinch)
    const onPointerDown = (e: React.PointerEvent) => {
      hasInteractedRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2) {
        stopInertia();
        const [p1, p2] = Array.from(pointers.current.values());
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        pinchStart.current.zoom = zoom;
        pinchStart.current.panX = pan.x;
        pinchStart.current.panY = pan.y;

        const rect = wrapperRef.current!.getBoundingClientRect();
        pinchStart.current.mid = {
          x: mid.x - rect.left - rect.width / 2,
          y: mid.y - rect.top - rect.height / 2,
        };
        pinchStart.current.dist = Math.max(1, dist);
        draggingRef.current = false;
        return;
      }

      // Single pointer drag
      stopInertia();
      draggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      lastMoveRef.current = { t: performance.now(), x: e.clientX, y: e.clientY };
      velocityRef.current = { vx: 0, vy: 0 };
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Pinch
      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const factor = clamp(dist / pinchStart.current.dist, 0.05, 20);
        const newZoom = clamp(+(pinchStart.current.zoom * factor).toFixed(3), 0.05, 10);

        const k = newZoom / pinchStart.current.zoom;
        const nx = k * (pinchStart.current.panX - pinchStart.current.mid.x) + pinchStart.current.mid.x;
        const ny = k * (pinchStart.current.panY - pinchStart.current.mid.y) + pinchStart.current.mid.y;

        setZoom(newZoom);
        setPan(clampPan(nx, ny));
        return;
      }

      // Drag
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const nx = dragStartRef.current.panX + dx;
      const ny = dragStartRef.current.panY + dy;
      setPan(clampPan(nx, ny));

      const now = performance.now();
      const dt = Math.max(1, now - lastMoveRef.current.t);
      velocityRef.current = {
        vx: (e.clientX - lastMoveRef.current.x) / dt,
        vy: (e.clientY - lastMoveRef.current.y) / dt,
      };
      lastMoveRef.current = { t: now, x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      pointers.current.delete(e.pointerId);

      if (pointers.current.size >= 1) return; // another finger still down

      if (draggingRef.current) {
        draggingRef.current = false;
        startInertia();
      }
    };

    // Wheel zoom (Ctrl/⌘ + wheel at cursor)
    const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
      const withModifier = e.ctrlKey || e.metaKey;
      if (!withModifier) return;
      e.preventDefault();
      hasInteractedRef.current = true;

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = clamp(+(zoom * factor).toFixed(3), 0.05, 10);

      const dims = getViewAndBase();
      if (!dims) return setZoom(newZoom);

      const rect = dims.wrap.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      const k = newZoom / zoom;
      const nx = k * (pan.x - cx) + cx;
      const ny = k * (pan.y - cy) + cy;

      setZoom(newZoom);
      requestAnimationFrame(() => setPan(clampPan(nx, ny)));
    };

    // Double-click: toggle 1:1 vs fit
    const onDoubleClick = () => {
      hasInteractedRef.current = true;
      if (Math.abs(zoom - 1) < 0.02) {
        fitToView();
      } else {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    useEffect(() => () => {
      if (inertiaRAF.current != null) cancelAnimationFrame(inertiaRAF.current);
    }, []);

    return (
      <div className="relative rounded-2xl bg-white p-3 ring-1 ring-black/5">
        <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm text-black/70">Zoom</label>
          <input
            type="range"
            min={0.05}
            max={10}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              hasInteractedRef.current = true;
              setZoom(parseFloat(e.target.value));
            }}
            className="w-full"
            aria-label="Zoom"
          />
        <span className="sm:w-16 text-right tabular-nums text-xs text-black/60">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => { hasInteractedRef.current = true; fitToView(); }}
            className="ml-auto rounded-lg border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50"
            aria-label="Fit to view"
          >
            Fit
          </button>
        </div>

        <div
          ref={wrapperRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
          className={[
            "relative grid place-items-center rounded-xl p-2 sm:p-4",
            "bg-[conic-gradient(at_20%_20%,#fafafa,#f4f4f5)]",
            "max-h-[70vh] md:max-h-[72vh]",
            "overflow-hidden select-none touch-none",
            "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          aria-busy={loading}
        >
          <canvas
            ref={ref}
            className="max-w-full h-auto shadow-sm ring-1 ring-black/5 will-change-transform"
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
  }
);

CanvasStage.displayName = "CanvasStage";
export default CanvasStage;
