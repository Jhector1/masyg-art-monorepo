'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import Image from 'next/image';

type Dir = 1 | -1;

export default function ZoomCarouselModal({
  images,
  startIndex = 0,
  isOpen,
  onClose,
  title,
}: {
  images: string[];
  startIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}) {
  const total = images.length;
  const [index, setIndex] = useState(startIndex);
  const overlayRef = useRef<HTMLDivElement>(null);

  // slide strip motion (prev|current|next across 300%)
  const x = useMotionValue(0);
  const [vw, setVw] = useState(0);

  // zoom/pan for current image
  const scale = useMotionValue(1);
  const imgX = useMotionValue(0);
  const imgY = useMotionValue(0);

  // slide gesture state
  const downX = useRef(0);
  const downY = useRef(0);
  const downT = useRef(0);
  const dragging = useRef(false);

  // pinch gesture state
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const pinchCenterStart = useRef({ x: 0, y: 0 }); // relative to rect center (px)

  // pan origins while zoomed
  const panX = useRef(0);
  const panY = useRef(0);

  const ELASTIC = 1.04;
  const SPRING = { type: 'spring' as const, stiffness: 210, damping: 24, mass: 0.9 };
  const CLICK_DIST = 10;
  const SWIPE_DIST = 60;
  const SWIPE_VEL = 0.6; // px/ms
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const wrap = (i: number) => (total ? (i + total) % total : 0);
  const nextIndex = wrap(index + 1);
  const prevIndex = wrap(index - 1);

  const go = (dir: Dir) => setIndex((p) => wrap(p + dir));
  const step = async (dir: Dir) => {
    if (!vw) return go(dir);
    await animate(x, dir === 1 ? -vw * ELASTIC : vw * ELASTIC, SPRING);
    await animate(x, dir === 1 ? -vw : vw, SPRING);
    go(dir);
    x.set(0);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]); // eslint-disable-line

  useEffect(() => {
    if (!isOpen) return;
    const m = () => setVw(overlayRef.current?.clientWidth ?? window.innerWidth);
    m();
    const ro = new ResizeObserver(m);
    if (overlayRef.current) ro.observe(overlayRef.current);
    window.addEventListener('resize', m);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', m);
    };
  }, [isOpen]);

  useEffect(() => {
    // reset zoom on image change
    animate(scale, 1, { duration: 0.15 });
    animate(imgX, 0, { duration: 0.15 });
    animate(imgY, 0, { duration: 0.15 });
    panX.current = 0;
    panY.current = 0;
  }, [index]); // eslint-disable-line

  // helpers for pinch
  const getRect = () =>
    (overlayRef.current?.getBoundingClientRect() ??
      ({ width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 } as DOMRect));

  const updatePointer = (id: number, xPos: number, yPos: number) => {
    pointers.current.set(id, { x: xPos, y: yPos });
  };

  const currentPinchData = () => {
    const pts = Array.from(pointers.current.values());
    if (pts.length < 2) return null;
    const [p1, p2] = pts;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    return { dist, cx, cy };
    };

  // ----- Gestures (outer frame) -----
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!isOpen) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    updatePointer(e.pointerId, e.clientX, e.clientY);

    if (pointers.current.size === 2) {
      // start pinch
      const p = currentPinchData()!;
      const rect = getRect();
      pinching.current = true;
      pinchStartDist.current = p.dist;
      pinchStartScale.current = scale.get();
      pinchCenterStart.current = {
        x: p.cx - (rect.left + rect.width / 2),
        y: p.cy - (rect.top + rect.height / 2),
      };
      panX.current = imgX.get();
      panY.current = imgY.get();
      return;
    }

    // single-finger start (slide or prepare to pan if already zoomed)
    downX.current = e.clientX;
    downY.current = e.clientY;
    downT.current = performance.now();
    dragging.current = true;
    x.stop();
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!isOpen) return;

    // update active pointer
    if (pointers.current.has(e.pointerId)) {
      updatePointer(e.pointerId, e.clientX, e.clientY);
    }

    // active pinch
    if (pinching.current && pointers.current.size >= 2) {
      const p = currentPinchData();
      if (!p) return;
      const rect = getRect();
      const factor = p.dist / Math.max(1, pinchStartDist.current);
      const next = clamp(pinchStartScale.current * factor, ZOOM_MIN, ZOOM_MAX);

      // keep pinch center stable
      const maxX = (rect.width * (next - 1)) / 2;
      const maxY = (rect.height * (next - 1)) / 2;

      const cxRel = p.cx - (rect.left + rect.width / 2); // current center relative to frame center
      const cyRel = p.cy - (rect.top + rect.height / 2);

      // derive target translation so that the same visual point stays under the pinch center
      const dxFromStart = cxRel - pinchCenterStart.current.x;
      const dyFromStart = cyRel - pinchCenterStart.current.y;

      const nx = clamp(panX.current - pinchCenterStart.current.x * (next - pinchStartScale.current) + dxFromStart, -maxX, maxX);
      const ny = clamp(panY.current - pinchCenterStart.current.y * (next - pinchStartScale.current) + dyFromStart, -maxY, maxY);

      scale.set(next);
      imgX.set(nx);
      imgY.set(ny);
      return;
    }

    // if zoomed (no pinch), drag pans the image
    if (scale.get() > 1 && dragging.current) {
      const rect = getRect();
      const s = scale.get();
      const dx = e.clientX - downX.current;
      const dy = e.clientY - downY.current;
      const maxX = (rect.width * (s - 1)) / 2;
      const maxY = (rect.height * (s - 1)) / 2;
      imgX.set(clamp(panX.current + dx, -maxX, maxX));
      imgY.set(clamp(panY.current + dy, -maxY, maxY));
      return;
    }

    // otherwise single-finger slide
    if (dragging.current && vw) {
      const dx = e.clientX - downX.current;
      x.set(Math.max(-vw, Math.min(vw, dx)));
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // remove pointer
    pointers.current.delete(e.pointerId);

    // end pinch first
    if (pinching.current) {
      if (pointers.current.size < 2) {
        pinching.current = false;
        // store pan origin for next move
        panX.current = imgX.get();
        panY.current = imgY.get();
      }
      return; // IMPORTANT: never treat as click/slide when finishing a pinch
    }

    if (!vw) return;

    // if zoomed, finish pan; do not close
    if (scale.get() > 1) {
      panX.current = imgX.get();
      panY.current = imgY.get();
      dragging.current = false;
      return;
    }

    // single-finger slide/click logic
    const dt = performance.now() - downT.current;
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;
    dragging.current = false;

    const absDx = Math.abs(dx);
    const vel = absDx / Math.max(dt, 1);

    // tiny move → close
    if (absDx < CLICK_DIST && Math.abs(dy) < CLICK_DIST) {
      onClose();
      return;
    }

    // swipe next/prev
    if (absDx > SWIPE_DIST || vel > SWIPE_VEL) {
      const dir: Dir = dx < 0 ? 1 : -1;
      const target = dir === 1 ? -vw : vw;
      animate(x, target * ELASTIC, SPRING)
        .then(() => animate(x, target, SPRING))
        .then(() => {
          go(dir);
          x.set(0);
        });
    } else {
      animate(x, -dx * 0.12, SPRING).then(() => animate(x, 0, SPRING));
    }
  };

  // wheel + double-click zoom (desktop)
  const onDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const rect = getRect();
    const next = scale.get() > 1 ? 1 : 2.5;
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const maxX = (rect.width * (next - 1)) / 2;
    const maxY = (rect.height * (next - 1)) / 2;
    const tx = clamp(-dx * (next - 1), -maxX, maxX);
    const ty = clamp(-dy * (next - 1), -maxY, maxY);
    animate(scale, next, { type: 'spring', stiffness: 260, damping: 28 });
    animate(imgX, next === 1 ? 0 : tx, { type: 'spring', stiffness: 260, damping: 28 });
    animate(imgY, next === 1 ? 0 : ty, { type: 'spring', stiffness: 260, damping: 28 });
    if (next === 1) { panX.current = 0; panY.current = 0; }
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const rect = getRect();
    const delta = -e.deltaY; // up → zoom in
    const factor = Math.exp(delta * 0.0018);
    const current = scale.get();
    const next = clamp(current * factor, ZOOM_MIN, ZOOM_MAX);

    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const maxX = (rect.width * (next - 1)) / 2;
    const maxY = (rect.height * (next - 1)) / 2;

    const nx = clamp(imgX.get() - cx * (next - current), -maxX, maxX);
    const ny = clamp(imgY.get() - cy * (next - current), -maxY, maxY);

    animate(scale, next, { duration: 0.12 });
    animate(imgX, next === 1 ? 0 : nx, { duration: 0.12 });
    animate(imgY, next === 1 ? 0 : ny, { duration: 0.12 });

    if (next === 1) { panX.current = 0; panY.current = 0; }
  };

  const sizes = useMemo(
    () => '(max-width: 640px) 92vw, (max-width: 1024px) 80vw, 1200px',
    []
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Image gallery'}
      // IMPORTANT: these run on the overlay so we can pinch anywhere
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[110] rounded-full bg-white/80 px-3 py-1.5 text-black shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/70"
        aria-label="Close"
      >
        ✕
      </button>

      {/* Counter */}
      <div className="absolute left-1/2 -translate-x-1/2 top-4 z-[110] text-xs text-white/90 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full">
        {index + 1}/{total}
      </div>

      {/* Desktop arrows */}
      {total > 1 && (
        <>
          <button
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-[110] items-center justify-center rounded-full bg-white/80 px-3 py-2 text-black shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/70 active:scale-95"
            aria-label="Previous"
            onClick={() => step(-1)}
          >
            ◀
          </button>
          <button
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-[110] items-center justify-center rounded-full bg-white/80 px-3 py-2 text-black shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/70 active:scale-95"
            aria-label="Next"
            onClick={() => step(1)}
          >
            ▶
          </button>
        </>
      )}

      {/* Slides strip */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0 w-[300%] h-full flex"
          style={{
            x,
            // allow custom pinch/drag; disable browser gestures
            touchAction: 'none' as any,
            cursor: scale.get() > 1 ? 'grab' : 'auto',
          }}
        >
          {/* Prev */}
          <div className="relative h-full w-1/3">
            <Image
              src={images[prevIndex] ?? '/placeholder.png'}
              alt={`Slide ${prevIndex + 1}`}
              fill
              sizes={sizes}
              className="object-contain opacity-90 pointer-events-none"
              draggable={false}
              priority
            />
          </div>

          {/* Current (zoom + pan) */}
          <div className="relative h-full w-1/3 overflow-hidden">
            <motion.div
              className="absolute inset-0"
              style={{ scale, x: imgX, y: imgY, touchAction: 'none' as any }}
              onDoubleClick={onDoubleClick}
              onWheel={onWheel}
            >
              <Image
                src={images[index] ?? '/placeholder.png'}
                alt={`Slide ${index + 1}`}
                fill
                sizes={sizes}
                className="object-contain"
                draggable={false}
                priority
              />
            </motion.div>
          </div>

          {/* Next */}
          <div className="relative h-full w-1/3">
            <Image
              src={images[nextIndex] ?? '/placeholder.png'}
              alt={`Slide ${nextIndex + 1}`}
              fill
              sizes={sizes}
              className="object-contain opacity-90 pointer-events-none"
              draggable={false}
              priority
            />
          </div>
        </motion.div>
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
