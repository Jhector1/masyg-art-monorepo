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
export function normalizeTypes(types: TypesParam): Variant[] | "ALL" {
  if (types === "ALL") return "ALL";
  if (!types || (Array.isArray(types) && types.length === 0)) return NON_ORIGINAL;
  const filtered = (types as Variant[]).filter(t => VALID.has(t));
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
