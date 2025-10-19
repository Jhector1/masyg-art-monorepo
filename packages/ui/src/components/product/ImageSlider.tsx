"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import NextImage from "next/image";
import ImageModal from "../store/ImageModal";

type Dir = 1 | -1;

interface ImageSliderProps {
  images?: string[];
  autoPlayMs?: number;
}

export default function ImageSlider({
  images = [],
  autoPlayMs = 4500,
}: ImageSliderProps) {
  const [index, setIndex] = useState(0);
  const [autoDir, setAutoDir] = useState<Dir>(1); // ping-pong
  const [isTouch, setIsTouch] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [zoomImage, setZoomImage] = useState<{
    src: string;
    title: string;
  } | null>(null);

  const total = images.length;
  const frameRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const [frameW, setFrameW] = useState(0);
  const x = useMotionValue(0);

  // pointer swipe state
  const downX = useRef(0);
  const downY = useRef(0);
  const downT = useRef(0);
  const lastX = useRef(0);
  const dragging = useRef(false);

  // thresholds
  const CLICK_DIST = 10; // px → consider it a click
  const SWIPE_DIST = 60; // px → consider it a swipe
  const SWIPE_VEL = 0.6; // px/ms → flick velocity
  const ELASTIC = 1.04;

  const SPRING = {
    type: "spring" as const,
    stiffness: 210,
    damping: 24,
    mass: 0.9,
  };

  useEffect(() => {
    setIsTouch(
      typeof navigator !== "undefined" && navigator.maxTouchPoints > 0
    );
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      setFrameW(el.clientWidth);
      x.set(0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (frameRef.current) ro.observe(frameRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrap = (i: number) => (total ? (i + total) % total : 0);
  const nextIndex = wrap(index + 1);
  const prevIndex = wrap(index - 1);
  const go = (dir: Dir) => setIndex((p) => wrap(p + dir));

  // autoplay ping-pong
  useEffect(() => {
    if (
      total <= 1 ||
      isPaused ||
      (typeof document !== "undefined" && document.hidden)
    )
      return;
    timerRef.current = window.setTimeout(async () => {
      if (!frameW) return go(autoDir);
      const dir = autoDir;
      await animate(
        x,
        dir === 1 ? -frameW * ELASTIC : frameW * ELASTIC,
        SPRING
      );
      await animate(x, dir === 1 ? -frameW : frameW, SPRING);
      go(dir);
      x.set(0);
      setAutoDir((d) => {
        const atStart = index === 0;
        const atEnd = index === total - 1;
        if (atEnd) return -1 as Dir;
        if (atStart) return 1 as Dir;
        return d;
      });
    }, autoPlayMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, isPaused, total, autoPlayMs, frameW, x, autoDir]);

  useEffect(() => {
    const onVis = () => setIsPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (total <= 1) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, frameW]);

  const step = async (dir: Dir) => {
    if (!frameW) return go(dir);
    await animate(x, dir === 1 ? -frameW * ELASTIC : frameW * ELASTIC, SPRING);
    await animate(x, dir === 1 ? -frameW : frameW, SPRING);
    go(dir);
    x.set(0);
  };

  if (total === 0) return null;

  // subtle FX on current slide
  const scaleFx = useTransform(x, (val) =>
    frameW ? 1 - 0.02 * Math.min(1, Math.abs(val) / frameW) : 1
  );
  const filter = useTransform(x, (val) => {
    if (!frameW) return "blur(0px)";
    const px = (Math.min(Math.abs(val), frameW) / frameW) * 2;
    return `blur(${px}px)`;
  });

  const sizes = useMemo(
    () => "(max-width: 640px) 92vw, (max-width: 1024px) 80vw, 720px",
    []
  );

  const openZoom = () => {
    const src = images[index] || "/placeholder.png";
    let imageSrc = src;
    if (typeof window !== "undefined") {
      try {
        imageSrc = new URL(src, window.location.origin).toString();
      } catch {
        /* ignore */
      }
    }
    setZoomImage({ src: imageSrc, title: `Slide ${index + 1}` });
  };

  // --- Pointer swipe logic on the entire frame (no Framer drag) ---
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!frameRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    downX.current = e.clientX;
    downY.current = e.clientY;
    downT.current = performance.now();
    lastX.current = e.clientX;
    dragging.current = true;
    setIsPaused(true);
    // cancel any running animation so we can follow finger
    x.stop();
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragging.current || !frameW) return;
    // horizontal swipe only (ignore vertical)
    const dx = e.clientX - downX.current;
    // clamp to 1 frame width
    const clamped = Math.max(-frameW, Math.min(frameW, dx));
    x.set(clamped);
    lastX.current = e.clientX;
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!frameW) return;
    const dt = performance.now() - downT.current;
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;
    const absDx = Math.abs(dx);
    const vel = absDx / Math.max(dt, 1); // px per ms

    dragging.current = false;
    setIsPaused(false);

    // Click if tiny movement
    if (absDx < CLICK_DIST && Math.abs(dy) < CLICK_DIST) {
      // snap back and open zoom
      animate(x, 0, SPRING).then(() => {
        openZoom();
      });
      return;
    }

    // Swipe next/prev if over distance or flick velocity
    if (absDx > SWIPE_DIST || vel > SWIPE_VEL) {
      const dir: Dir = dx < 0 ? 1 : -1; // left swipe → next
      const target = dir === 1 ? -frameW : frameW;
      animate(x, target * ELASTIC, SPRING)
        .then(() => animate(x, target, SPRING))
        .then(() => {
          go(dir);
          x.set(0);
        });
    } else {
      // not enough → bounce back
      animate(x, -dx * 0.12, SPRING).then(() => animate(x, 0, SPRING));
    }
  };

  return (
    <div
      className="relative w-full max-w-3xl mx-auto overflow-hidden rounded-2xl shadow-xl select-none bg-neutral-900"
      onPointerEnter={() => !isTouch && setIsPaused(true)}
      onPointerLeave={() => !isTouch && setIsPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image slider"
    >
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/30 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/30 to-transparent z-10 pointer-events-none" />

      <div className="absolute top-3 right-3 z-20 text-xs text-white/90 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full">
        {index + 1}/{total}
      </div>

      {/* Frame (handles pointer swipe + click tolerance) */}
      <div
        ref={frameRef}
        className="relative w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative w-full aspect-[4/3] sm:aspect-[3/2] md:aspect-[16/10] lg:aspect-[16/9] max-h-[80vh]">
          <motion.div
            className="absolute inset-0 w-[300%] h-full flex"
            style={{ x, touchAction: "none" as any, cursor: "grab" }}
          >
            {/* Prev */}
            <div className="relative h-full w-1/3">
              <NextImage
                src={images[prevIndex]}
                alt={`Slide ${prevIndex + 1}`}
                fill
                sizes={sizes}
                draggable={false}
                className="object-contain opacity-90 pointer-events-none"
              />
            </div>

            {/* Current (click/tap to open modal; small drifts allowed) */}
            <div className="relative h-full w-1/3 overflow-hidden">
              <motion.div
                className="absolute inset-0 cursor-zoom-in"
                style={{ scale: scaleFx, filter }}
              >
                <NextImage
                  key={images[index]}
                  src={images[index]}
                  alt={`Slide ${index + 1}`}
                  fill
                  sizes={sizes}
                  priority
                  draggable={false}
                  className="object-contain"
                />
              </motion.div>
            </div>

            {/* Next */}
            <div className="relative h-full w-1/3">
              <NextImage
                src={images[nextIndex]}
                alt={`Slide ${nextIndex + 1}`}
                fill
                sizes={sizes}
                draggable={false}
                className="object-contain opacity-90 pointer-events-none"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {total > 1 && (
        <div className="flex justify-center mt-4 gap-2 pb-3">
          {images.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => {
                if (i === index || !frameW) return;
                const forward = (i - index + total) % total;
                const backward = (index - i + total) % total;
                step(forward <= backward ? 1 : -1);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-5 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
      {!isTouch && total > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            className="group absolute left-2 top-1/2 -translate-y-1/2 z-30
                 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow
                 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/70
                 active:scale-95 transition"
            onClick={() => step(-1)}
          >
            <span className="block text-black leading-none select-none">
              ◀
            </span>
          </button>

          <button
            type="button"
            aria-label="Next slide"
            className="group absolute right-2 top-1/2 -translate-y-1/2 z-30
                 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow
                 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/70
                 active:scale-95 transition"
            onClick={() => step(1)}
          >
            <span className="block text-black leading-none select-none">
              ▶
            </span>
          </button>
        </>
      )}

      {/* ImageModal zoom (same API as ProductImage) */}
      {zoomImage && (
        <ImageModal
          image={zoomImage.src}
          title={zoomImage.title}
          isOpen
          onClose={() => setZoomImage(null)}
        />
      )}
    </div>
  );
}
