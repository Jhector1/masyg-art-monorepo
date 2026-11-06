/** Shared pure validation for canonical product-media gallery ordering. */
export class GalleryOrderError extends Error {
  constructor(message: string, readonly status: 400 | 409) { super(message); this.name = "GalleryOrderError"; }
}
export function orderedGalleryIds(requested: unknown, existing: readonly string[]): string[] {
  if (!Array.isArray(requested) || requested.length !== existing.length || requested.length > 50 ||
      requested.some(v => typeof v !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(v))) {
    throw new GalleryOrderError("Gallery order must contain exactly the current image IDs (maximum 50)", 400);
  }
  const ids = requested as string[];
  if (new Set(ids).size !== ids.length || ids.some(id => !existing.includes(id))) {
    throw new GalleryOrderError("Gallery images changed; reload before saving order", 409);
  }
  return ids;
}
