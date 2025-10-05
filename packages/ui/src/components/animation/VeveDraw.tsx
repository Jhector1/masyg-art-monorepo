"use client";
import { motion, useInView } from "framer-motion";
import { CSSProperties, useId, useMemo, useRef } from "react";

export type PathItem = { d: string; transform?: string };

type GradientStop = { offset: string | number; color: string; opacity?: number };
type LoopMode = "pingpong" | "restart";
// add this helper type near the top
type InViewMargin =
  | `${number}px`
  | `${number}px ${number}px`
  | `${number}px ${number}px ${number}px ${number}px`;
type Props = {
  /** Array of path data. Use PathItem[] if you need per-path transform. */
  paths: PathItem[] | string[];

  /** SVG viewBox, e.g. "0 0 1024 1024". If omitted, defaults to 1024 square. */
  viewBox?: string;

  /** Solid stroke color (overrides gradient if provided). */
  stroke?: string;

  /** Custom gradient stops (used when `stroke` is not provided). */
  gradientStops?: GradientStop[];

  /** Stroke width in SVG user units (used when responsiveStroke=false). */
  strokeWidth?: number;

  /** Make stroke responsive via CSS clamp(). */
  responsiveStroke?: boolean;
  /** Minimum stroke px when responsive. */
  minStrokePx?: number;
  /** Maximum stroke px when responsive. */
  maxStrokePx?: number;
  /** Middle term for clamp(), in vw units (e.g., 0.9 => 0.9vw). */
  vwStroke?: number;

  /** Seconds per path to draw. */
  duration?: number;
  /** Stagger (seconds) between path starts. */
  delayStep?: number;

  /** Loop forever. */
  loop?: boolean;
  /** Loop behavior: pingpong (reverse) or restart (snap). */
  loopMode?: LoopMode;

  /** Default: "xMidYMid meet". Use "none" to stretch. */
  preserveAspectRatio?: string;

  /** In-view margin (rootMargin) for starting the animation. */
  inViewMargin?: InViewMargin; // <- was string

  /** Extra style for the <svg>. */
  style?: CSSProperties;
  className?: string;
};

export default function VeveDraw({
  paths,
  viewBox = "0 0 1024 1024",
  stroke,
  gradientStops,
  strokeWidth = 10,
  responsiveStroke = false,
  minStrokePx = 1.5,
  maxStrokePx = 12,
  vwStroke = 0.9,
  duration = 1.6,
  delayStep = 0.12,
  loop = false,
  loopMode = "pingpong",
  preserveAspectRatio = "xMidYMid meet",
  inViewMargin = "0px 0px -160px 0px",
  style,
  className = "w-full h-auto",
}: Props) {
  const ref = useRef<SVGSVGElement | null>(null);
  const inView = useInView(ref, { margin: inViewMargin, once: !loop });
  const gid = useId();

  // Normalize input to PathItem[]
  const items: PathItem[] = useMemo(
    () =>
      (paths as PathItem[]).map((p) =>
        typeof p === "string" ? { d: p } : p
      ),
    [paths]
  );

  const swVar = `clamp(${minStrokePx}px, ${vwStroke}vw, ${maxStrokePx}px)`;
  const useGradient = !stroke;

  const stops: GradientStop[] =
    gradientStops ??
    [
      { offset: "0%", color: "#FF6A00" },
      { offset: "20%", color: "#FFC300" },
      { offset: "40%", color: "#8DFF00" },
      { offset: "60%", color: "#00E5FF" },
      { offset: "80%", color: "#007BFF" },
      { offset: "100%", color: "#6A00FF" },
    ];

  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      style={{
        overflow: "visible", // avoid clipping thick strokes
        ...(responsiveStroke ? ({ ["--sw" as any]: swVar } as any) : {}),
        ...style,
      }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {useGradient && (
        <defs>
          <linearGradient id={`veve-rg-${gid}`} x1="0" y1="0" x2="1" y2="0">
            {stops.map((s, i) => (
              <stop
                key={i}
                offset={typeof s.offset === "number" ? `${s.offset}%` : s.offset}
                stopColor={s.color}
                stopOpacity={s.opacity ?? 1}
              />
            ))}
          </linearGradient>
        </defs>
      )}

      {items.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          transform={p.transform}
          stroke={useGradient ? `url(#veve-rg-${gid})` : stroke}
          // responsive stroke (keeps width in px regardless of SVG scale)
          {...(responsiveStroke
            ? {
                style: { strokeWidth: "var(--sw)" },
                vectorEffect: "non-scaling-stroke" as const,
              }
            : { strokeWidth })}
          initial={{ pathLength: 0, opacity: 0.9 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{
            duration,
            delay: i * delayStep,
            ease: "easeInOut",
            repeat: loop ? Infinity : 0,
            repeatType: loop ? (loopMode === "restart" ? "loop" : "reverse") : undefined,
            repeatDelay: loop ? 0.4 : 0,
          }}
        />
      ))}
    </svg>
  );
}
