// packages/server/src/utils/variants.ts
export type Variant = "DIGITAL" | "PRINT" | "ORIGINAL";
export type TypesParam = Variant[] | "ALL" | undefined;

const VALID = new Set<Variant>(["DIGITAL", "PRINT", "ORIGINAL"]);
const NON_ORIGINAL: Variant[] = ["DIGITAL", "PRINT"];

/** Normalize rules:
 * - includes ORIGINAL  -> ["ORIGINAL"]
 * - missing/empty/etc. -> ["DIGITAL","PRINT"]
 * - "ALL"              -> "ALL"
 */
// packages/server/src/utils/variants.ts

export function normalizeTypes(types: unknown): Variant[] | "ALL" {
  // Support passing "ALL" either as a string or inside an array
  if (types === "ALL") return "ALL";
  if (Array.isArray(types) && types.map(String).includes("ALL")) return "ALL";

  if (types == null) return NON_ORIGINAL;

  // Coerce to string[]
  const raw: string[] = Array.isArray(types)
    ? (types as unknown[]).map(String)
    : typeof types === "string"
      ? types.split(",") // supports "DIGITAL,PRINT"
      : [String(types)];

  const filtered = raw
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .filter((t): t is Variant => VALID.has(t as Variant));

  return filtered.includes("ORIGINAL") ? (["ORIGINAL"] as Variant[]) : NON_ORIGINAL;
}


/** Product WHERE by normalized types.
 * - ORIGINAL path: strictly ORIGINAL variants
 * - Non-original path: DIGITAL/PRINT + NULL types, and products with zero variants
 * - ALL: no variant filter
 */
export function variantProductWhere(normalized: Variant[] | "ALL") {
  if (normalized === "ALL") return {};

  if (normalized.length === 1 && normalized[0] === "ORIGINAL") {
    return { variants: { some: { type: "ORIGINAL" } } };
  }

  return {
    OR: [
      { variants: { some: { OR: [{ type: { in: normalized } }, { type: { equals: null } }] } } },
      { variants: { none: {} } },
    ],
  };
}
