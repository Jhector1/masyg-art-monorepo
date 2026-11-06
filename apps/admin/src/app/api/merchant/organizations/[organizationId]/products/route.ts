import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { createMerchantProduct } from "@acme/core/lib/tenancy";
import { catalogCreateInput } from "@acme/core/lib/catalog-contract";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string }> };
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const verifiedUserId = await requireMerchantPrincipal();
    const { organizationId } = await ctx.params;
    const data = catalogCreateInput.parse(await req.json());
    const product = await createMerchantProduct({ verifiedUserId, organizationId, ...data });
    return NextResponse.json(product, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
