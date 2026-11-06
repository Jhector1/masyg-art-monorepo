/** Pure, testable preview crop and rotation validation. */
export class PreviewEditError extends Error {
  constructor(message: string, readonly status = 400) { super(message); this.name = "PreviewEditError"; }
}
export type PreviewTransform = { rotate?: 0 | 90 | 180 | 270; crop?: { x: number; y: number; width: number; height: number } };
/** Apply cropping/rotation to incoming ORIGINAL before the stored PREVIEW watermark. */
export function readPreviewTransform(raw: unknown): PreviewTransform {
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw !== "string" || raw.length > 300) throw new PreviewEditError("Invalid image editing options");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new PreviewEditError("Invalid image editing options"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PreviewEditError("Invalid image editing options");
  const data = parsed as Record<string, unknown>;
  if (Object.keys(data).some(key => !["rotate", "crop"].includes(key))) throw new PreviewEditError("Invalid image editing options");
  const result: PreviewTransform = {};
  if (data.rotate !== undefined) {
    if (![0, 90, 180, 270].includes(data.rotate as number)) throw new PreviewEditError("Rotation must be 0, 90, 180 or 270 degrees");
    result.rotate = data.rotate as 0 | 90 | 180 | 270;
  }
  if (data.crop !== undefined) {
    if (!data.crop || typeof data.crop !== "object" || Array.isArray(data.crop)) throw new PreviewEditError("Invalid crop rectangle");
    const crop = data.crop as Record<string, unknown>;
    if (Object.keys(crop).length !== 4 || !["x", "y", "width", "height"].every(key => key in crop)) throw new PreviewEditError("Invalid crop rectangle");
    const good = (value: unknown, min: number) => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= 12000;
    if (!good(crop.x, 0) || !good(crop.y, 0) || !good(crop.width, 1) || !good(crop.height, 1)) throw new PreviewEditError("Crop coordinates must be valid image pixels");
    result.crop = crop as PreviewTransform["crop"];
  }
  return result;
}
