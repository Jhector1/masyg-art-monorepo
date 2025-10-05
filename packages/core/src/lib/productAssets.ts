// File: src/lib/productAssets.ts
import type { Prisma, PrismaClient } from "@prisma/client";

/* ──────────────────────────── MIME / EXT HELPERS ──────────────────────────── */

export function extFromUrl(url: string) {
  try {
    const clean = url.split("?")[0];
    const f = clean.split("/").pop() ?? "";
    const parts = f.split(".");
    return (parts.length > 1 ? parts.pop() : "")!.toLowerCase();
  } catch {
    return "";
  }
}

export function mimeFromExt(ext: string) {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    tiff: "image/tiff",
    tif: "image/tiff",
    avif: "image/avif",
  };
  return map[ext] || "application/octet-stream";
}

export const isVectorExt = (ext: string) => ext === "svg" || ext === "pdf";

/* ───────────────────────── Cloudinary PARSER (robust) ─────────────────────── */

/**
 * Parse Cloudinary identity from a secure_url:
 *   /<cloud>/<resource_type>/<type>/[<transformations>/]v<ver>/<public_id>.<ext>
 *
 * Works with mixed resource types and optional transformation segment.
 */
export function parseCloudinaryIdentity(url: string): {
  publicId: string;
  resourceType: "image" | "raw" | "video";
  deliveryType: "upload" | "authenticated" | "private";
} | null {
  try {
    const u = new URL(url);

    // Accept any Cloudinary-like host (res.cloudinary.com or custom)
    if (!/cloudinary\.com$/i.test(u.hostname) && !/cloudinary/i.test(u.hostname)) {
      // Not a strict requirement; return null to avoid wrong assumptions
      return null;
    }

    const parts = u.pathname.split("/").filter(Boolean);
    // parts[0] = <cloud_name>
    const resourceType = parts[1] as "image" | "raw" | "video" | undefined;
    const deliveryType =
      parts[2] as "upload" | "authenticated" | "private" | undefined;
    if (!resourceType || !deliveryType) return null;

    // After /<cloud>/<resource>/<type> comes optional transformations, then v###
    const tail = parts.slice(3);
    // Find version marker
    const vIdx = tail.findIndex((s) => /^v\d+$/.test(s));
    const afterVersion = vIdx >= 0 ? tail.slice(vIdx + 1) : tail;

    const last = afterVersion.join("/");
    const lastNoQuery = last.split("?")[0];
    const dot = lastNoQuery.lastIndexOf(".");
    const publicId =
      dot > 0 ? decodeURIComponent(lastNoQuery.slice(0, dot)) : decodeURIComponent(lastNoQuery);

    if (!publicId) return null;

    return { publicId, resourceType, deliveryType };
  } catch {
    return null;
  }
}

/* ─────────────────────────── UPSERT (DB write path) ───────────────────────── */

type Tx = PrismaClient | Prisma.TransactionClient;

export type UpsertAssetArgs = {
  productId: string;
  url: string;

  /** Cloudinary public_id (no extension). Prefer passing this when you have it. */
  storageKey?: string | null;

  /** Optional preview image URL to show in the UI. */
  previewUrl?: string | null;

  // known or derived
  ext?: string;
  mimeType?: string;
  isVector?: boolean;

  // optional metadata
  width?: number;
  height?: number;
  sizeBytes?: number;
  dpi?: number | null;
  colorProfile?: string | null;

  /** Cloudinary buckets — strongly recommended to pass from upload response. */
  resourceType?: "image" | "raw" | "video";
  deliveryType?: "upload" | "authenticated" | "private";

  /** If true, allow a storageKey to be reused by multiple products (remove @unique in schema first). */
  allowCrossProductShare?: boolean;
};

/**
 * Idempotent upsert for ProductAsset with "storageKey-first" behavior.
 * - If storageKey exists:
 *    • update when same product
 *    • skip or move when different product (based on allowCrossProductShare)
 * - Else fallback to composite unique (productId, url).
 * Also persists Cloudinary resourceType/deliveryType for reliable zipping.
 */
export async function upsertProductAsset(tx: Tx, args: UpsertAssetArgs) {
  const {
    productId,
    url,
    storageKey: storageKeyArg,
    previewUrl,
    ext: extArg,
    mimeType: mimeArg,
    isVector: isVectorArg,
    width,
    height,
    sizeBytes,
    dpi,
    colorProfile,
    resourceType: resourceTypeArg,
    deliveryType: deliveryTypeArg,
    allowCrossProductShare = false,
  } = args;

  // Derive identity if missing
  const parsed = parseCloudinaryIdentity(url);

  const storageKey =
    storageKeyArg ??
    (parsed?.publicId /* best-effort from URL */) ??
    undefined;

  const resourceType =
    resourceTypeArg ??
    (parsed?.resourceType as "image" | "raw" | "video" | undefined);

  const deliveryType =
    deliveryTypeArg ??
    (parsed?.deliveryType as "upload" | "authenticated" | "private" | undefined);

  const ext = (extArg || extFromUrl(url)).toLowerCase();
  const mimeType = mimeArg || mimeFromExt(ext);
  const isVector = isVectorArg ?? isVectorExt(ext);

  // If we have a storageKey, prefer that path
  if (storageKey) {
    const existing = await (tx as any).productAsset.findUnique({
      where: { storageKey },
    });

    if (existing) {
      if (existing.productId !== productId && !allowCrossProductShare) {
        // Keep invariant: a single Cloudinary file belongs to one product
        console.warn(
          `⚠️ storageKey already used by product ${existing.productId}; skipping for product ${productId}: ${storageKey}`
        );
        return existing;
      }

      return (tx as any).productAsset.update({
        where: { storageKey },
        data: {
          productId, // in case you move ownership
          url,
          previewUrl: previewUrl ?? undefined,
          ext,
          mimeType,
          isVector,
          width,
          height,
          sizeBytes,
          dpi: dpi ?? undefined,
          colorProfile: colorProfile ?? undefined,
          // NEW
          resourceType: resourceType ?? existing.resourceType ?? null,
          deliveryType: deliveryType ?? existing.deliveryType ?? null,
        },
      });
    }

    // Create new keyed by storageKey
    return (tx as any).productAsset.create({
      data: {
        productId,
        url,
        storageKey,
        previewUrl: previewUrl ?? undefined,
        ext,
        mimeType,
        isVector,
        width,
        height,
        sizeBytes,
        dpi: dpi ?? undefined,
        colorProfile: colorProfile ?? undefined,
        // NEW
        resourceType: resourceType ?? null,
        deliveryType: deliveryType ?? null,
      },
    });
  }

  // Fallback: composite unique on (productId, url)
  return (tx as any).productAsset.upsert({
    where: { productId_url: { productId, url } },
    update: {
      previewUrl: previewUrl ?? undefined,
      ext,
      mimeType,
      isVector,
      width,
      height,
      sizeBytes,
      dpi: dpi ?? undefined,
      colorProfile: colorProfile ?? undefined,
      // NEW
      resourceType: resourceType ?? null,
      deliveryType: deliveryType ?? null,
    },
    create: {
      productId,
      url,
      previewUrl: previewUrl ?? undefined,
      ext,
      mimeType,
      isVector,
      width,
      height,
      sizeBytes,
      dpi: dpi ?? undefined,
      colorProfile: colorProfile ?? undefined,
      // NEW
      resourceType: resourceType ?? null,
      deliveryType: deliveryType ?? null,
      // If we were able to parse public_id from URL, persist it as storageKey too
      storageKey: parsed?.publicId ?? null,
    },
  });
}
