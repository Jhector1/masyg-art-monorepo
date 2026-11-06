import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { requireMerchantAccess, validateTenantId } from "@acme/core/lib/tenancy";
import { prisma } from "@acme/core/lib/prisma";
import { reorderMerchantGallery } from "@acme/core/lib/merchant-gallery";
import { GalleryOrderError } from "@acme/core/lib/merchant-gallery-order";
import { addMerchantMedia, parsePreviewTransform, MerchantMediaError, MAX_DIGITAL_FILE_BYTES } from "@acme/server/lib/merchant-cloudinary";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ organizationId: string; productId: string }> };
const headers = { "Cache-Control": "private, no-store" };
function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) throw new MerchantMediaError("Request origin is not allowed");
  const length = req.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_DIGITAL_FILE_BYTES + 65536)) throw new MerchantMediaError("Upload too large", 413);
}
export async function GET(_req: NextRequest, context: Params) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await context.params;
    const scope = await requireMerchantAccess({ userId, organizationId, capability: "read" });
    const id = validateTenantId(productId);
    const product = await prisma.product.findFirst({ where: { id, organizationId: scope.organizationId }, select: {
      media: { orderBy: { sortOrder: "asc" }, select: { sortOrder: true, altText: true, asset: { select: { id: true, mimeType: true, private: true } } } },
      variants: { select: { id: true, name: true, fulfillment: true, digitalFiles: { select: { id: true, label: true, retiredAt: true, asset: { select: { mimeType: true } } } } } },
    } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    return NextResponse.json({ images: product.media.filter(m => !m.asset.private).map(m => ({ ...m.asset, sortOrder: m.sortOrder, altText: m.altText })), variants: product.variants }, { headers });
  } catch (e) { return merchantHttpError(e); }
}
export async function POST(req: NextRequest, context: Params) {
  try {
    checkOrigin(req);
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await context.params;
    const form = await req.formData();
    const kind = form.get("kind");
    if (kind !== "preview" && kind !== "digital") throw new MerchantMediaError("Invalid asset kind");
    const file = form.get("file");
    if (!(file instanceof File)) throw new MerchantMediaError("Select a file");
    const variantId = form.get("variantId");
    if (variantId !== null && typeof variantId !== "string") throw new MerchantMediaError("Invalid variant");
    const replaceAssetId = form.get("replaceAssetId");
    const replaceDigitalFileId = form.get("replaceDigitalFileId");
    const transform = form.get("edit");
    if ((replaceAssetId !== null && typeof replaceAssetId !== "string") || (replaceDigitalFileId !== null && typeof replaceDigitalFileId !== "string") ||
        (transform !== null && typeof transform !== "string")) throw new MerchantMediaError("Invalid media replacement options");
    if (kind === "digital" && transform !== null) throw new MerchantMediaError("Digital originals cannot use public image transformations");
    const result = await addMerchantMedia({ userId, organizationId, productId, kind, file,
      variantId: variantId || undefined, replaceAssetId: replaceAssetId || undefined,
      replaceDigitalFileId: replaceDigitalFileId || undefined,
      edit: kind === "preview" ? parsePreviewTransform(transform) : undefined });
    return NextResponse.json(result, { status: 201, headers });
  } catch (e) {
    if (e instanceof MerchantMediaError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    return merchantHttpError(e);
  }
}

/** Setting first sortOrder to zero selects the cover image; no new asset is created. */
export async function PATCH(req: NextRequest, context: Params) {
  try {
    const origin = req.headers.get("origin");
    if (origin !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers });
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await context.params;
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !("orderedAssetIds" in body)) {
      return NextResponse.json({ error: "Invalid gallery order" }, { status: 400, headers });
    }
    const result = await reorderMerchantGallery({ userId, organizationId, productId, orderedAssetIds: (body as { orderedAssetIds: unknown }).orderedAssetIds });
    return NextResponse.json(result, { headers });
  } catch (e) {
    if (e instanceof GalleryOrderError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    return merchantHttpError(e);
  }
}
