'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, animate, useTransform } from 'framer-motion';
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

  // slide motion
  const x = useMotionValue(0);
  const [vw, setVw] = useState(0);

  // zoom/pan for current image
  const scale = useMotionValue(1);
  const imgX = useMotionValue(0);
  const imgY = useMotionValue(0);

  // pointer state for slide
  const downX = useRef(0);
  const downY = useRef(0);
  const downT = useRef(0);
  const dragging = useRef(false);

  // pointer state for pan (while zoomed)
  const panX = useRef(0);
  const panY = useRef(0);

  const ELASTIC = 1.04;
  const SPRING = { type: 'spring' as const, stiffness: 210, damping: 24, mass: 0.9 };
  const CLICK_DIST = 10;
  const SWIPE_DIST = 60;
  const SWIPE_VEL = 0.6; // px/ms
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;

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
    // reset transform on image change
    animate(scale, 1, { duration: 0.15 });
    animate(imgX, 0, { duration: 0.15 });
    animate(imgY, 0, { duration: 0.15 });
  }, [index]); // eslint-disable-line

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

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  // ----- Slide gestures (outer frame) -----
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!isOpen) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    downX.current = e.clientX;
    downY.current = e.clientY;
    downT.current = performance.now();
    dragging.current = true;
    x.stop(); // follow finger immediately
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragging.current || !vw) return;
    // if zoomed, we don't slide the strip — we pan the image instead
    if (scale.get() > 1) {
      const dx = e.clientX - downX.current;
      const dy = e.clientY - downY.current;
      const s = scale.get();
      const maxX = (vw * (s - 1)) / 2;
      const maxY = ((overlayRef.current?.clientHeight ?? window.innerHeight) * (s - 1)) / 2;
      imgX.set(clamp(panX.current + dx, -maxX, maxX));
      imgY.set(clamp(panY.current + dy, -maxY, maxY));
      return;
    }
    const dx = e.clientX - downX.current;
    x.set(Math.max(-vw, Math.min(vw, dx)));
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!vw) return;
    const dt = performance.now() - downT.current;
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;
    dragging.current = false;

    if (scale.get() > 1) {
      // finish panning and store origin for next gesture
      panX.current = imgX.get();
      panY.current = imgY.get();
      return;
    }

    const absDx = Math.abs(dx);
    const vel = absDx / Math.max(dt, 1);

    // tiny move → click (close)
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

  // ----- Zoom controls on current image -----
  const onDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const next = scale.get() > 1 ? 1 : 2.5;
    // center toward clicked point
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const maxX = (rect.width * (next - 1)) / 2;
    const maxY = (rect.height * (next - 1)) / 2;
    const tx = clamp(-dx * (next - 1), -maxX, maxX);
    const ty = clamp(-dy * (next - 1), -maxY, maxY);
    animate(scale, next, { type: 'spring', stiffness: 260, damping: 28 });
    animate(imgX, next === 1 ? 0 : tx, { type: 'spring', stiffness: 260, damping: 28 });
    animate(imgY, next === 1 ? 0 : ty, { type: 'spring', stiffness: 260, damping: 28 });
    if (next === 1) {
      panX.current = 0;
      panY.current = 0;
    }
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const delta = -e.deltaY; // up → zoom in
    const factor = Math.exp(delta * 0.0018);
    const current = scale.get();
    const next = clamp(current * factor, ZOOM_MIN, ZOOM_MAX);

    // keep pointer under cursor stable
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const maxX = (rect.width * (next - 1)) / 2;
    const maxY = (rect.height * (next - 1)) / 2;

    const nx = clamp(imgX.get() - cx * (next - current), -maxX, maxX);
    const ny = clamp(imgY.get() - cy * (next - current), -maxY, maxY);

    animate(scale, next, { duration: 0.12 });
    animate(imgX, next === 1 ? 0 : nx, { duration: 0.12 });
    animate(imgY, next === 1 ? 0 : ny, { duration: 0.12 });

    if (next === 1) {
      panX.current = 0;
      panY.current = 0;
    }
  };

  const sizes = useMemo(
    () => '(max-width: 640px) 92vw, (max-width: 1024px) 80vw, 1200px',
    []
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-white "
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Image gallery'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Close (top-right) */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[110] rounded-full bg-white/80 px-3 py-1.5 text-black shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/70"
        aria-label="Close"
      >
        ✕
      </button>

      {/* Index badge */}
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

      {/* Slides */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0 w-[300%] h-full flex"
          style={{ x, touchAction: 'none' as any, cursor: scale.get() > 1 ? 'grab' : 'auto' }}
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
              style={{ scale, x: imgX, y: imgY }}
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
            {/* Help hint (mobile) */}
            <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/90 bg-black/50 rounded-full px-2 py-0.5">
              Pinch/drag to zoom, swipe to close/next
            </div>
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
