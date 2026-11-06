import { NextRequest, NextResponse } from "next/server";
import { listMerchantProducts, createMerchantProduct } from "@acme/core/lib/tenancy";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { storeCatalogCreateInput } from "@acme/core/lib/catalog-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };
export async function GET(req: NextRequest, context: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, storeId } = await context.params;
    const products = await listMerchantProducts({
      userId, organizationId, storeId, query: req.nextUrl.searchParams.get("q") ?? undefined,
    });
    return NextResponse.json(products, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}


/** One transaction: product + variants + draft listing; no orphan product on conflict. */
export async function POST(req: NextRequest, context: Ctx) {
  try {
    const verifiedUserId = await requireMerchantPrincipal();
    const { organizationId, storeId } = await context.params;
    const input = storeCatalogCreateInput.parse(await req.json());
    const product = await createMerchantProduct({
      verifiedUserId, organizationId, storeId, listingSlug: input.slug,
      title: input.title, description: input.description, offersDigitalLicenses: input.offersDigitalLicenses, offersFraming:input.offersFraming, offersGlazing:input.offersGlazing, variants: input.variants,
    });
    return NextResponse.json(product, { status: 201,
      headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
