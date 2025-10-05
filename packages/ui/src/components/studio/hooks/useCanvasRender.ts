// src/components/editor/hooks/useCanvasRender.ts
"use client";

import { useCallback, useRef, useState } from "react";

export function useCanvasRender() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1); // UI-only; panning/zoom are CSS

  const drawUrl = useCallback((url: string) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve();

        const dpr = window.devicePixelRatio || 1;
        // Backing store in device pixels (crisp)
        canvas.width = Math.max(1, Math.floor(img.width * dpr));
        canvas.height = Math.max(1, Math.floor(img.height * dpr));

        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve();

        (ctx as any).imageSmoothingEnabled = true;
        (ctx as any).imageSmoothingQuality = "high";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);

        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }, []);

  return { canvasRef, zoom, setZoom, drawUrl };
}
