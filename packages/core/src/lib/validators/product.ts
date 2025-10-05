// // src/lib/validators/product.ts
// import { z } from "zod";
// import { parseList } from "../auth";

// const zStringOrList = z
//   .union([z.string(), z.array(z.string())])
//   .optional()
//   .transform((v) => parseList(v ?? ""));

// const toNullUndefOrNumber = (v: unknown) => {
//   if (v === undefined) return undefined;              // leave unchanged
//   if (v === null) return null;                        // clear field
//   if (typeof v === "string" && v.trim() === "") return null; // blank -> clear
//   const n = Number(v);
//   return Number.isFinite(n) ? n : null;               // invalid -> clear
// };

// // Preserve undefined vs null, accept ISO *or* "YYYY-MM-DDTHH:mm"
// const zOptNullDate = z
//   .union([z.string(), z.date(), z.null(), z.undefined()])
//   .transform((v) => {
//     if (v === undefined) return undefined; // untouched
//     if (v === null) return null;           // clear
//     if (v instanceof Date) return v;

//     const s = (v as string).trim?.() ?? "";
//     if (s === "") return null;

//     // Accept "datetime-local" without offset or full ISO with offset
//     // const isLocalNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);
//     const d = new Date(s); // JS treats no-TZ as local time (ok for admin UI)
//     return Number.isNaN(+d) ? null : d;
//   });

// export const ProductUpdateSchema = z
//   .object({
//     title: z.string().min(1),
//     description: z.string().min(1),
//     price: z.coerce.number().min(0),
//     categoryId: z.string().min(1),

//     publicId: z.string().min(1),

//     sizes: zStringOrList,
//     thumbnails: zStringOrList,
//     formats: zStringOrList,

//     svgFormat: z.string().optional().nullable().transform((v) => (v?.trim() ? v : null)),
//     svgPreview: z.string().optional().nullable().transform((v) => (v?.trim() ? v : null)),

//     salePercent: z
//       .any()
//       .transform(toNullUndefOrNumber)
//       .refine(
//         (v) =>
//           v === undefined ||
//           v === null ||
//           (Number.isInteger(v as number) && (v as number) >= 1 && (v as number) <= 100),
//         { message: "salePercent must be an integer 1..100, or empty to clear" }
//       )
//       .optional(),

//     salePrice: z
//       .any()
//       .transform(toNullUndefOrNumber)
//       .refine(
//         (v) => v === undefined || v === null || (typeof v === "number" && v >= 0),
//         { message: "salePrice must be ≥ 0, or empty to clear" }
//       )
//       .optional(),

//     saleStartsAt: zOptNullDate, // Date | null | undefined
//     saleEndsAt: zOptNullDate,   // Date | null | undefined
//   })
//   .refine(
//     (d) => {
//       if (d.saleStartsAt instanceof Date && d.saleEndsAt instanceof Date) {
//         return d.saleEndsAt > d.saleStartsAt;
//       }
//       return true;
//     },
//     { path: ["saleEndsAt"], message: "saleEndsAt must be after saleStartsAt" }
//   );

// export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
import { z } from "zod";

// If you already have this somewhere else, keep your original and delete these helpers.
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
  if (v === undefined) return undefined;                     // leave unchanged
  if (v === null) return null;                               // clear
  if (typeof v === "string" && v.trim() === "") return null; // blank -> clear
  const n = Number(v);
  return Number.isFinite(n) ? n : null;                      // invalid -> clear
};

// Preserve undefined vs null; accept ISO OR "YYYY-MM-DDTHH:mm" (datetime-local).
const zOptNullDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined) return undefined; // untouched
    if (v === null) return null;           // clear
    if (v instanceof Date) return v;
    const s = (v as string).trim?.() ?? "";
    if (s === "") return null;
    // "datetime-local" (no tz) or ISO; new Date() interprets local for no-tz strings.
    const d = new Date(s);
    return Number.isNaN(+d) ? null : d;
  });

/** CREATE schema (if you need strict create). Keep your existing version if you have one. */
export const ProductCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().min(0),
  categoryId: z.string().min(1),
  publicId: z.string().min(1),
  sizes: z.union([z.string(), z.array(z.string())]).transform(parseList),
  thumbnails: z.union([z.string(), z.array(z.string())]).transform(parseList),
  formats: z.union([z.string(), z.array(z.string())]).transform(parseList),
  svgFormat: z.string().optional().nullable().transform((v) => (v?.trim() ? v : null)),
  svgPreview: z.string().optional().nullable().transform((v) => (v?.trim() ? v : null)),
  salePercent: z.any().transform(toNullUndefOrNumber)
    .refine(
      (v) =>
        v === undefined ||
        v === null ||
        (Number.isInteger(v as number) && (v as number) >= 1 && (v as number) <= 100),
      { message: "salePercent must be an integer 1..100, or empty to clear" }
    ),
  salePrice: z.any().transform(toNullUndefOrNumber)
    .refine((v) => v === undefined || v === null || (typeof v === "number" && v >= 0), {
      message: "salePrice must be ≥ 0, or empty to clear",
    }),
  saleStartsAt: zOptNullDate,
  saleEndsAt: zOptNullDate,
}).refine(
  (d) => {
    if (d.saleStartsAt instanceof Date && d.saleEndsAt instanceof Date) {
      return d.saleEndsAt > d.saleStartsAt;
    }
    return true;
  },
  { path: ["saleEndsAt"], message: "saleEndsAt must be after saleStartsAt" }
);

/** PATCH schema: EVERYTHING optional, with safe transforms.
 * undefined → don't change; "" → null (clear); valid values → update
 */
export const ProductPatchSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  categoryId: z.string().min(1).optional(),
  publicId: z.string().min(1).optional(),

  // Keep undefined when not provided; only parse when provided
  sizes: z.union([z.string(), z.array(z.string())]).optional()
    .transform((v) => (v === undefined ? undefined : parseList(v))),
  thumbnails: z.union([z.string(), z.array(z.string())]).optional()
    .transform((v) => (v === undefined ? undefined : parseList(v))),
  formats: z.union([z.string(), z.array(z.string())]).optional()
    .transform((v) => (v === undefined ? undefined : parseList(v))),

  svgFormat: z.string().optional().nullable()
    .transform((v) => (v === undefined ? undefined : (v?.trim() ? v : null))),
  svgPreview: z.string().optional().nullable()
    .transform((v) => (v === undefined ? undefined : (v?.trim() ? v : null))),

  salePercent: z.any().optional()
    .transform(toNullUndefOrNumber)
    .refine(
      (v) =>
        v === undefined ||
        v === null ||
        (Number.isInteger(v as number) && (v as number) >= 1 && (v as number) <= 100),
      { message: "salePercent must be an integer 1..100, or empty to clear" }
    ),
  salePrice: z.any().optional()
    .transform(toNullUndefOrNumber)
    .refine((v) => v === undefined || v === null || (typeof v === "number" && v >= 0), {
      message: "salePrice must be ≥ 0, or empty to clear",
    }),
  saleStartsAt: zOptNullDate,  // Date | null | undefined
  saleEndsAt: zOptNullDate,    // Date | null | undefined
}).refine(
  (d) => {
    if (d.saleStartsAt instanceof Date && d.saleEndsAt instanceof Date) {
      return d.saleEndsAt > d.saleStartsAt;
    }
    return true;
  },
  { path: ["saleEndsAt"], message: "saleEndsAt must be after saleStartsAt" }
);

export type ProductPatchInput = z.infer<typeof ProductPatchSchema>;
