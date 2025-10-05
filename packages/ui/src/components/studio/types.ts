export type StyleState = {
  fillColor: string;
  fillOpacity?: number; // 0..1
  strokeColor: string;
  strokeOpacity?: number; // 0..1
  strokeWidth: number;
  backgroundColor: string;
  backgroundOpacity?: number; // 0..1
  defs?: string;
};

export type LinearStop = { offset: number; color: string; opacity?: number };

export type GradientDef =
  | { id: string; from: string; to: string; angle?: number }
  | { id: string; angle?: number; stops: LinearStop[] };

export type PatternDef = { id: string; svg: string; preview: string };

export const EXPORT_FORMATS = ["png", "jpg", "webp", "tiff", "svg"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type SaveResp = {
  ok: boolean;
  canExport: boolean;
  exportsLeft: number;
  purchased: boolean;
};

export type ExportMode = "scale" | "px" | "print";
export type ExportUnit = "in" | "mm";