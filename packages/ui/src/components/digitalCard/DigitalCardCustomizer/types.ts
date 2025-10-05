// ─────────────────────────────────────────────────────────────────────────────
// FILE: components/DigitalCardCustomizer/types.ts
// ─────────────────────────────────────────────────────────────────────────────
export type FaceKey = "front" | "back" | "inLeft" | "inRight";

export type BaseEl = {
  id: string;
  type: "text" | "emoji" | "image";
  xPct: number; // 0..100 (left)
  yPct: number; // 0..100 (top)
  rotation: number; // deg
  scale: number; // 0.3..3
  opacity: number; // 0..1
  z: number; // stacking index
};

// In TextEl:
export type TextEl = BaseEl & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: 400 | 600 | 700;
  fontStyle: "normal" | "italic";
  align: "left" | "center" | "right";
  shadow: boolean;
  bg?: string | null;
  pad?: number;
  boxWidthPct?: number; // ← add (percent of face width)
};

export type EmojiEl = BaseEl & {
  type: "emoji";
  emoji: string;
  fontSize: number; // base px (before scale)
};

export type ImageEl = BaseEl & {
  type: "image";
  url: string;
  widthPct: number; // % of face width (before scale)
  aspect?: number | null;
};

export type DesignEl = TextEl | EmojiEl | ImageEl;

export interface RealisticGreetingCardProps {
  width?: number;  // base design width in px
  height?: number; // base design height in px
}
