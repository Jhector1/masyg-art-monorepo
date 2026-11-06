import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { requireMerchantAccess, validateTenantId } from "@acme/core/lib/tenancy";
import { prisma } from "@acme/core/lib/prisma";
import { detachMerchantPreview } from "@acme/core/lib/merchant-gallery";
import { updateMerchantImageAlt, MediaMetadataError } from "@acme/core/lib/merchant-media-metadata";
import { publicImageUrl, destroyDetachedPublicPreview, MerchantMediaError } from "@acme/server/lib/merchant-cloudinary";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, ctx: { params: Promise<{ organizationId: string; productId: string; assetId: string }> }) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId, assetId } = await ctx.params;
    const scope = await requireMerchantAccess({ userId, organizationId, capability: "read" });
    const media = await prisma.productMedia.findFirst({ where: {
      organizationId: scope.organizationId, productId: validateTenantId(productId), assetId: validateTenantId(assetId), asset: { private: false },
    }, select: { asset: { select: { storageKey: true } } } });
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.redirect(publicImageUrl(media.asset.storageKey, req.nextUrl.searchParams.get("size") === "thumb" ? "thumbnail" : "preview"), { status: 302, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (e) {
    if (e instanceof MerchantMediaError) return NextResponse.json({ error: e.message }, { status: e.status });
    return merchantHttpError(e);
  }
}

/** Unlink a preview and reclaim its Cloudinary object where no other references exist. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ organizationId: string; productId: string; assetId: string }> }) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId, assetId } = await ctx.params;
    const result = await detachMerchantPreview({ userId, organizationId, productId, assetId });
    let cleanupPending = false;
    if (result.storageKey) {
      try { cleanupPending = !(await destroyDetachedPublicPreview(result.storageKey)); }
      catch (e) { cleanupPending = true; console.error("Cloudinary preview cleanup pending", e); }
    }
    if (cleanupPending && result.storageKey) {
      try { await prisma.merchantAuditLog.create({ data: {
        organizationId, actorUserId: userId,
        action: "catalog.gallery.cloudinary_cleanup_pending", targetType: "MediaAsset", targetId: assetId,
        metadata: { productId, storageKey: result.storageKey },
      } }); } catch (e) { console.error("Failed to persist Cloudinary cleanup audit", e); }
    }
    return NextResponse.json({ detached: true, cleanupPending }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof MerchantMediaError) return NextResponse.json({ error: e.message }, { status: e.status });
    return merchantHttpError(e);
  }
}

/** Update product-specific alt text without mutating Cloudinary or other stores. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ organizationId: string; productId: string; assetId: string }> }) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId, assetId } = await ctx.params;
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("altText" in body)) {
      return NextResponse.json({ error: "Invalid alternative text" }, { status: 400 });
    }
    return NextResponse.json(await updateMerchantImageAlt({ userId, organizationId, productId, assetId,
      altText: (body as { altText: unknown }).altText }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MediaMetadataError) return NextResponse.json({ error: error.message }, { status: error.status });
    return merchantHttpError(error);
  }
}
