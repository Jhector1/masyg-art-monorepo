import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { retireMerchantDigitalFile } from "@acme/core/lib/merchant-media-metadata";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** No Cloudinary deletion here: old buyers may still own the old file. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ organizationId: string; productId: string; digitalFileId: string }> }) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId, digitalFileId } = await ctx.params;
    const result = await retireMerchantDigitalFile({ userId, organizationId, productId, digitalFileId });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
