import "server-only";
/** Canonical Cloudinary media pipeline. Never reuse legacy Product.urls/format arrays. */
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess, validateTenantId, TenantAccessError } from "@acme/core/lib/tenancy";

export class MerchantMediaError extends Error {
  constructor(message: string, readonly status: 400 | 409 | 413 | 503 = 400) {
    super(message); this.name = "MerchantMediaError";
  }
}
export type MediaKind = "preview" | "digital";
import { readPreviewTransform, PreviewEditError, type PreviewTransform } from "@acme/core/lib/merchant-preview-transform";
export type { PreviewTransform };
export function parsePreviewTransform(raw: unknown): PreviewTransform {
  try { return readPreviewTransform(raw); }
  catch (error) {
    if (error instanceof PreviewEditError) throw new MerchantMediaError(error.message);
    throw error;
  }
}

export const MAX_PUBLIC_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_DIGITAL_FILE_BYTES = 40 * 1024 * 1024;

/** Byte sniffing rather than trusting File.type or a user-controlled filename. SVG is PRIVATE-only. */
export function detectFileType(data: Buffer): string | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (data.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (data.length >= 4 && data[0] === 80 && data[1] === 75 && data[2] === 3 && data[3] === 4) return "application/zip";
  const head = data.subarray(0, 2048).toString("utf8").trimStart().replace(/^<\?xml[^>]*\?>\s*/i, "").trimStart();
  if (/^<svg(?:\s|>)/i.test(head)) return "image/svg+xml";
  return null;
}
export function validateUpload(data: Buffer, kind: MediaKind): string {
  const limit = kind === "preview" ? MAX_PUBLIC_IMAGE_BYTES : MAX_DIGITAL_FILE_BYTES;
  if (!data.length || data.length > limit) throw new MerchantMediaError(`File must be between 1 byte and ${Math.floor(limit / 1048576)} MB`, 413);
  const detected = detectFileType(data);
  if (kind === "preview" && !["image/png", "image/jpeg", "image/webp"].includes(detected ?? "")) {
    throw new MerchantMediaError("Public previews support PNG, JPEG or WebP only");
  }
  if (kind === "digital" && !["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf", "application/zip"].includes(detected ?? "")) {
    throw new MerchantMediaError("Digital delivery supports PNG, JPEG, WebP, SVG, PDF or ZIP");
  }
  return detected!;
}
function cloudinaryReady() {
  // CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET stay server-side only.
  cloudinary.config({ secure: true });
  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) throw new MerchantMediaError("Cloudinary is not configured on the Admin server", 503);
}
export function parsePublicCloudinaryKey(key: string): string | null {
  const prefix = "cloudinary:image:upload:";
  const id = key.startsWith(prefix) ? key.slice(prefix.length) : "";
  return /^ziledigital\/[a-zA-Z0-9_-]{3,128}\/products\/[a-zA-Z0-9_-]{3,128}\/preview\/[a-f0-9-]{36}$/.test(id) ? id : null;
}
export function publicImageUrl(key: string, presentation: "preview" | "thumbnail" = "preview"): string {
  const publicId = parsePublicCloudinaryKey(key);
  if (!publicId) throw new MerchantMediaError("Invalid public asset key", 409);
  cloudinaryReady();
  const url = cloudinary.url(publicId, { secure: true, resource_type: "image", type: "upload",
    ...(presentation === "thumbnail" ? { width: 240, height: 240, crop: "fill", gravity: "center", quality: "auto:eco" } : { quality: "auto" }) });
  const destination = new URL(url);
  if (destination.protocol !== "https:" || !destination.hostname.endsWith(".cloudinary.com")) {
    throw new MerchantMediaError("Invalid Cloudinary delivery URL", 503);
  }
  return url;
}
async function uploadBytes(buffer: Buffer, opts: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => err ? reject(err) : result ? resolve(result) : reject(new Error("No Cloudinary result")));
    stream.end(buffer);
  });
}
/** Authorization happens before Cloudinary I/O; composite FKs enforce scope when linked. */
export async function addMerchantMedia(args: {
  userId: string; organizationId: string; productId: string; variantId?: string;
  kind: MediaKind; file: File; replaceAssetId?: string; replaceDigitalFileId?: string; edit?: PreviewTransform;
}) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const organizationId = scope.organizationId;
  const productId = validateTenantId(args.productId);
  const product = await prisma.product.findFirst({ where: { id: productId, organizationId, status: { not: "ARCHIVED" } }, select: { id: true } });
  if (!product) throw new TenantAccessError(404);
  if (args.replaceAssetId && (args.kind !== "preview" || args.replaceDigitalFileId)) throw new MerchantMediaError("Invalid preview replacement");
  if (args.replaceDigitalFileId && (args.kind !== "digital" || args.replaceAssetId)) throw new MerchantMediaError("Invalid digital replacement");
  if (args.kind === "digital" && args.edit && Object.keys(args.edit).length) throw new MerchantMediaError("Private originals cannot use public preview transforms");
  const replaceAssetId = args.replaceAssetId ? validateTenantId(args.replaceAssetId) : undefined;
  const replaceDigitalFileId = args.replaceDigitalFileId ? validateTenantId(args.replaceDigitalFileId) : undefined;
  let variantId: string | undefined;
  if (args.kind === "digital") {
    if (!args.variantId) throw new MerchantMediaError("Choose a digital variant");
    variantId = validateTenantId(args.variantId);
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId, organizationId, fulfillment: "DIGITAL" }, select: { id: true } });
    if (!variant) throw new TenantAccessError(404);
  } else if (args.variantId) throw new MerchantMediaError("Public images cannot attach to a variant");

  const max = args.kind === "preview" ? MAX_PUBLIC_IMAGE_BYTES : MAX_DIGITAL_FILE_BYTES;
  if (!(args.file instanceof File) || args.file.size < 1 || args.file.size > max) throw new MerchantMediaError("Invalid file size", 413);
  const bytes = Buffer.from(await args.file.arrayBuffer());
  const mimeType = validateUpload(bytes, args.kind);
  const digest = createHash("sha256").update(bytes).digest("hex");
  cloudinaryReady();
  const suffix: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "application/pdf": ".pdf", "application/zip": ".zip" };
  // Cloudinary raw public IDs must retain an extension; never derive it from an untrusted name.
  const publicId = `ziledigital/${organizationId}/products/${productId}/${args.kind}/${randomUUID()}${args.kind === "digital" ? suffix[mimeType] : ""}`;
  const kind: "image" | "raw" = args.kind === "preview" ? "image" : "raw";
  const visibility: "upload" | "authenticated" = args.kind === "preview" ? "upload" : "authenticated";
  const edit = args.kind === "preview" ? parsePreviewTransform(args.edit ? JSON.stringify(args.edit) : undefined) : {};
  const incoming = [
    ...(edit.crop ? [{ crop: "crop", x: edit.crop.x, y: edit.crop.y, width: edit.crop.width, height: edit.crop.height }] : []),
    ...(edit.rotate ? [{ angle: edit.rotate }] : []),
    { width: 1200, height: 1200, crop: "limit", quality: "auto:good" },
    { overlay: { font_family: "Arial", font_size: 54, font_weight: "bold", text: "PREVIEW" }, gravity: "center", opacity: 40 },
  ] as UploadApiOptions["transformation"];
  const folder = `ziledigital/${organizationId}/products/${productId}/${args.kind}`;
  const resource: UploadApiOptions = {
    public_id: publicId, resource_type: kind, type: visibility,
    overwrite: false, use_filename: false, unique_filename: false,
    tags: ["ziledigital", `organization_${organizationId}`, `product_${productId}`, `kind_${args.kind}`],
    // Dynamic Cloudinary folders are opt-in. Fixed-folder accounts keep their existing public-ID structure.
    ...(process.env.CLOUDINARY_DYNAMIC_FOLDERS === "1" ? { asset_folder: folder } : {}),
    // Incoming transformation changes what Cloudinary STORES (not just delivery URL).
    // Art previews are capped in resolution and stamped before becoming public.
    ...(args.kind === "preview" ? { transformation: incoming } : {}),
  };
  const uploaded = await uploadBytes(bytes, resource);
  try {
    if (uploaded.public_id !== publicId || uploaded.resource_type !== kind) throw new MerchantMediaError("Unexpected upload response", 503);
    const committed = await prisma.$transaction(async tx => {
      // Re-check ownership and replacement target inside the transaction; stale IDs must not overwrite other products.
      const currentProduct = await tx.product.findFirst({ where: { id: productId, organizationId, status: { not: "ARCHIVED" } }, select: { id: true } });
      if (!currentProduct) throw new TenantAccessError(404);
      let previous: { storageKey: string } | null = null;
      let oldAltText: string | null = null;
      let oldOrder: number | null = null;
      if (replaceAssetId) {
        const current = await tx.productMedia.findUnique({ where: { organizationId_productId_assetId: { organizationId, productId, assetId: replaceAssetId } },
          select: { sortOrder: true, altText: true, asset: { select: { storageKey: true, private: true } } } });
        if (!current || current.asset.private) throw new TenantAccessError(404);
        oldOrder = current.sortOrder; oldAltText = current.altText;
        await tx.productMedia.delete({ where: { organizationId_productId_assetId: { organizationId, productId, assetId: replaceAssetId } } });
        const [otherMedia, digitalRefs] = await Promise.all([
          tx.productMedia.count({ where: { organizationId, assetId: replaceAssetId } }),
          tx.digitalFile.count({ where: { organizationId, assetId: replaceAssetId } }),
        ]);
        if (otherMedia === 0 && digitalRefs === 0) {
          await tx.mediaAsset.delete({ where: { organizationId, id: replaceAssetId } });
          previous = { storageKey: current.asset.storageKey };
        }
      }
      if (replaceDigitalFileId) {
        const prior = await tx.digitalFile.findFirst({ where: { id: replaceDigitalFileId, organizationId, variantId,
          retiredAt: null, asset: { private: true } }, select: { id: true } });
        if (!prior) throw new TenantAccessError(404);
        const retired = await tx.digitalFile.updateMany({ where: { id: prior.id, organizationId, retiredAt: null }, data: { retiredAt: new Date() } });
        if (retired.count !== 1) throw new MerchantMediaError("The digital file has already been replaced; refresh and try again", 409);
      }
      const asset = await tx.mediaAsset.create({ data: {
        organizationId, storageKey: `cloudinary:${kind}:${visibility}:${publicId}`,
        mimeType, sizeBytes: BigInt(bytes.length), checksumSha256: digest,
        private: args.kind === "digital",
      } });
      if (variantId) {
        await tx.digitalFile.create({ data: {
          organizationId, variantId, assetId: asset.id,
          label: args.file.name.slice(0, 180) || "Digital file",
        } });
      } else {
        const count = await tx.productMedia.count({ where: { organizationId, productId } });
        await tx.productMedia.create({ data: { organizationId, productId, assetId: asset.id, sortOrder: oldOrder ?? count, altText: oldAltText } });
      }
      await tx.merchantAuditLog.create({ data: {
        organizationId, actorUserId: args.userId,
        action: replaceDigitalFileId ? "catalog.digital-file.replaced" : replaceAssetId ? "catalog.preview-image.replaced" : variantId ? "catalog.digital-file.added" : "catalog.preview-image.added",
        targetType: "MediaAsset", targetId: asset.id,
        metadata: { productId, ...(variantId ? { variantId } : {}), ...(replaceAssetId ? { replacesAssetId: replaceAssetId } : {}), ...(replaceDigitalFileId ? { replacesDigitalFileId: replaceDigitalFileId } : {}) },
      } });
      return { assetId: asset.id, kind: args.kind, mimeType, fileName: variantId ? args.file.name.slice(0, 180) : undefined, previous };
    }, { timeout: 15000 });
    // Delete the old public PREVIEW only after the database transaction commits.
    // Digital files are retained: existing order snapshots/grants reference the old file.
    let cleanupPending = false;
    if (committed.previous) {
      try { cleanupPending = !(await destroyDetachedPublicPreview(committed.previous.storageKey)); }
      catch { cleanupPending = true; }
      if (cleanupPending) {
        try { await prisma.merchantAuditLog.create({ data: { organizationId, actorUserId: args.userId,
          action: "catalog.gallery.cloudinary_cleanup_pending", targetType: "MediaAsset", targetId: replaceAssetId!,
          metadata: { productId, storageKey: committed.previous.storageKey },
        } }); } catch (err) { console.error("Failed to persist media cleanup audit", err); }
      }
    }
    return { assetId: committed.assetId, kind: committed.kind, mimeType: committed.mimeType,
      fileName: committed.fileName, cleanupPending };
  } catch (error) {
    // Avoid leaking Cloudinary blobs when database linkage fails.
    try { await cloudinary.uploader.destroy(publicId, { resource_type: kind, type: visibility, invalidate: true }); }
    catch { /* Operational orphan cleanup still required if Cloudinary deletion fails. */ }
    throw error;
  }
}

/** Delete an orphaned, already-unlinked public preview. Never accept arbitrary keys. */
export async function destroyDetachedPublicPreview(storageKey: string): Promise<boolean> {
  const publicId = parsePublicCloudinaryKey(storageKey);
  if (!publicId) throw new MerchantMediaError("Invalid public asset key", 409);
  cloudinaryReady();
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "upload", invalidate: true });
  return result.result === "ok" || result.result === "not found";
}
