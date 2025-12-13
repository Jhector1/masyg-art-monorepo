// components/kind-info/getKindInfo.ts
export type ProductKind =
  | "ART"
  | "STICKER"
  | "MUG"
  | "CARD"
  | "BOOK_DIGITAL"
  | "OTHER";

type BaseInfo = {
  sizes?: string[];
};

export type StickerInfo = BaseInfo & {
  material?: string;
  finish?: string;
  cutType?: "kiss-cut" | "die-cut" | "sheet" | string;
  packQuantity?: number;
};

export type MugInfo = BaseInfo & {
  material?: string;
  mugColor?: string;
  dishwasherSafe?: boolean;
  capacity?: string; // e.g., "11oz", "15oz"
};

export type CardInfo = BaseInfo & {
  stock?: string;   // e.g., "350gsm"
  finish?: string;  // e.g., "Matte"
  packQuantity?: number;
};

export type BookDigitalInfo = BaseInfo & {
  isbn?: string;
  pageCount?: number;
  language?: string;
};

export type OtherOriginalInfo = {
  original?: {
    widthIn?: number;
    heightIn?: number;
    depthIn?: number;
    weightLb?: number;
    year?: number;
    medium?: string;
    surface?: string;
    framed?: boolean;
    sku?: string;
  };
  typeHint?: "ORIGINAL" | string;
};

export type KindInfo =
  | StickerInfo
  | MugInfo
  | CardInfo
  | BookDigitalInfo
  | OtherOriginalInfo
  | BaseInfo
  | null;

type ProductVariant = {
  size?: string | null;
  material?: string | null;
  frame?: string | null;
  license?: string | null;
  packQuantity?: number | null;
  medium?: string | null;
  surface?: string | null;
  widthIn?: number | null;
  heightIn?: number | null;
  depthIn?: number | null;
  weightLb?: number | null;
  year?: number | null;
  sku?: string | null;
  attributes?: any | null;
};

type Product = {
  kind?: ProductKind;
  sizes?: string[] | null;
  formats?: string[] | null;
  optionSchema?: any | null;  // prisma json
  kindInfo?: any | null;      // optional legacy field if you had one
  variants?: ProductVariant[] | null;
};

const uniq = <T,>(arr: (T | undefined | null)[]) =>
  Array.from(new Set(arr.filter(Boolean) as T[]));

/**
 * Prefer product.optionSchema.kindInfo -> product.kindInfo -> infer from variants.
 */
export function getKindInfo(product: Product): KindInfo {
  const direct =
    product?.optionSchema?.kindInfo ??
    product?.kindInfo ??
    null;

  if (direct) return direct as KindInfo;

  // Fallback: infer a minimal set from variants/sizes
  const sizes =
    product?.sizes?.length
      ? product.sizes!
      : uniq((product?.variants || []).map(v => v.size || undefined));

  // For OTHER/ORIGINAL we might infer an "original" block from a variant
  const maybeOriginal = (product?.variants || []).find(
    v => v?.attributes?.isOriginal || v?.sku // heuristic
  );

  if (maybeOriginal) {
    return {
      typeHint: "ORIGINAL",
      original: {
        widthIn: maybeOriginal.widthIn ?? undefined,
        heightIn: maybeOriginal.heightIn ?? undefined,
        depthIn: maybeOriginal.depthIn ?? undefined,
        weightLb: maybeOriginal.weightLb ?? undefined,
        year: maybeOriginal.year ?? undefined,
        medium: maybeOriginal.medium ?? undefined,
        surface: maybeOriginal.surface ?? undefined,
        framed: Boolean(maybeOriginal.attributes?.framed ?? false),
        sku: maybeOriginal.sku ?? undefined,
      },
      sizes,
    } as OtherOriginalInfo;
  }

  return { sizes };
}

/** Uppercased extensions (e.g., ["PNG","SVG"]) */
export function getFileExts(product: Product): string[] {
  const exts = (product?.formats || []).map(u => (u?.split(".").pop() ?? "").toUpperCase());
  return uniq(exts);
}
