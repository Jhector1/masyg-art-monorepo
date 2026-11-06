import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { findMerchantProduct } from "@acme/core/lib/tenancy";
import { setStoreListingStatus } from "@acme/core/lib/catalog-lifecycle";
import { listingPatchInput } from "@acme/core/lib/catalog-contract";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ organizationId: string; storeId: string; productId: string }> };
export async function GET(_req: NextRequest, ctx: Params) {
  try {
    const userId = await requireMerchantPrincipal();
    const params = await ctx.params;
    const product = await findMerchantProduct({ userId, ...params });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
export async function PATCH(req: NextRequest, ctx: Params) {
  try {
    const userId = await requireMerchantPrincipal();
    const params = await ctx.params;
    const { status } = listingPatchInput.parse(await req.json());
    return NextResponse.json(await setStoreListingStatus({ userId, ...params, status }));
  } catch (error) { return merchantHttpError(error); }
}
