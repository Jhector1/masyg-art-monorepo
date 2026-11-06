import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { updateCatalogProduct, archiveCatalogProduct, publishCatalogProduct } from "@acme/core/lib/catalog-lifecycle";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ organizationId: string; productId: string }> };
export async function PATCH(req: NextRequest, ctx: Params) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await ctx.params;
    const input: unknown = await req.json();
    const product = await updateCatalogProduct({ userId, organizationId, productId, changes: input });
    return NextResponse.json(product, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await ctx.params;
    return NextResponse.json(await archiveCatalogProduct({ userId, organizationId, productId }));
  } catch (error) { return merchantHttpError(error); }
}
export async function POST(_req: NextRequest, ctx: Params) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await ctx.params;
    return NextResponse.json(await publishCatalogProduct({ userId, organizationId, productId }));
  } catch (error) { return merchantHttpError(error); }
}
