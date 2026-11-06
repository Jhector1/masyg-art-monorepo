/** Authoritative digital license types. Merchant-configured variants own prices/files. */
export const DIGITAL_LICENSES = ["personal", "commercial", "extended"] as const;
export type DigitalLicenseKind = typeof DIGITAL_LICENSES[number];
export function licenseOf(attributes: unknown): DigitalLicenseKind | null {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return null;
  const license = (attributes as Record<string, unknown>).license;
  return DIGITAL_LICENSES.find(value => value === license) ?? null;
}
export function licensedVariantsReady(variants: readonly { fulfillment: string; active: boolean; attributes: unknown; digitalFiles?: readonly {id: string}[] }[], requireFiles: boolean): boolean {
  const digital = variants.filter(v => v.active && v.fulfillment === "DIGITAL");
  const kinds = new Set(digital.map(v => licenseOf(v.attributes)));
  return digital.length >= 2 && !kinds.has(null) && kinds.size === digital.length &&
    (!requireFiles || digital.every(v => (v.digitalFiles?.length ?? 0) > 0));
}
export function licenseAllowed(offers: boolean, fulfillment: string, attributes: unknown): boolean {
  if (fulfillment !== "DIGITAL") return true;
  // OFF means no license-tier *selector*, not that a legitimately licensed
  // fixed download becomes unsellable. Reject invalid, unknown license values.
  if (offers) return licenseOf(attributes) !== null;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return true;
  const value = (attributes as Record<string, unknown>).license;
  return value === undefined || licenseOf(attributes) !== null;
}

/** At most one edition per license tier per product, regardless of format or status.
 * Attach multiple private files to that one edition when several formats share terms. */
export function duplicateLicenseTier(
  variants: readonly { id?: string; fulfillment: string; attributes: unknown }[],
  tier: DigitalLicenseKind, exceptId?: string,
): boolean {
  return variants.some(v => v.fulfillment === "DIGITAL" && (exceptId === undefined || v.id !== exceptId) && licenseOf(v.attributes) === tier);
}
