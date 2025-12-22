import { z } from "zod";
import { ProductKind, Storefront } from "@prisma/client";

export function parseList(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split(/\r?\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const toNullUndefOrNumber = (v: unknown) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const zOptNullDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (v instanceof Date) return v;
    const s = (v as string).trim?.() ?? "";
    if (s === "") return null;
    const d = new Date(s);
    return Number.isNaN(+d) ? null : d;
  });

export const ProductPatchSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    price: z.coerce.number().min(0).optional(),
    categoryId: z.string().min(1).optional(),
    publicId: z.string().min(1).optional(),

    // ✅ ADD THESE TWO
    kind: z.nativeEnum(ProductKind).optional(),
    site: z.nativeEnum(Storefront).optional(),

    sizes: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) => (v === undefined ? undefined : parseList(v))),

    thumbnails: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) => (v === undefined ? undefined : parseList(v))),

    formats: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) => (v === undefined ? undefined : parseList(v))),

    svgFormat: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === undefined ? undefined : v?.trim() ? v : null)),

    svgPreview: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === undefined ? undefined : v?.trim() ? v : null)),

    salePercent: z
      .any()
      .optional()
      .transform(toNullUndefOrNumber)
      .refine(
        (v) =>
          v === undefined ||
          v === null ||
          (Number.isInteger(v as number) && (v as number) >= 1 && (v as number) <= 100),
        { message: "salePercent must be an integer 1..100, or empty to clear" }
      ),

    salePrice: z
      .any()
      .optional()
      .transform(toNullUndefOrNumber)
      .refine((v) => v === undefined || v === null || (typeof v === "number" && v >= 0), {
        message: "salePrice must be ≥ 0, or empty to clear",
      }),

    saleStartsAt: zOptNullDate, // Date | null | undefined
    saleEndsAt: zOptNullDate,   // Date | null | undefined
  })
  .refine(
    (d) => {
      if (d.saleStartsAt instanceof Date && d.saleEndsAt instanceof Date) {
        return d.saleEndsAt > d.saleStartsAt;
      }
      return true;
    },
    { path: ["saleEndsAt"], message: "saleEndsAt must be after saleStartsAt" }
  );

export type ProductPatchInput = z.infer<typeof ProductPatchSchema>;
