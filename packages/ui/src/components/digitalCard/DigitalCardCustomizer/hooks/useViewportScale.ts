
// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/hooks/useViewportScale.ts
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function useViewportScale(width: number, height: number) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);      // fit-to-width
  const [userScale, setUserScale] = useState(1); // user zoom
  const [outerH, setOuterH] = useState(height);

  const displayScale = scale * userScale;

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const s = Math.max(0.25, Math.min(2, w / width));
      setScale(s);
      setOuterH(Math.round(height * s * userScale));
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, userScale]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.06 : 0.94;
        setUserScale((u) => Math.min(4, Math.max(0.5, +(u * factor).toFixed(3))));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as any);
  }, []);

  const fit = () => setUserScale(1);

  return { wrapRef, displayScale, outerH, userScale, setUserScale, fit };
}

