import { NextRequest, NextResponse } from "next/server";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { getPublishedPreviewStorageKey } from "@acme/core/lib/public-media";
import { publicImageUrl } from "@acme/server/lib/merchant-cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only public preview media belonging to a published product on this published store.
 * Private downloadable originals never pass these filters or reach the URL signer.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ storeId: string; assetId: string }> }) {
  try {
    const { storeId, assetId } = await ctx.params;
    const storageKey = await getPublishedPreviewStorageKey({ storeId, assetId });
    return NextResponse.redirect(publicImageUrl(storageKey), {
      status: 302, headers: {
        "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof PublicCatalogError) return NextResponse.json({ error: "Not found" }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("Public preview delivery failed", error);
    return NextResponse.json({ error: "Media unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
