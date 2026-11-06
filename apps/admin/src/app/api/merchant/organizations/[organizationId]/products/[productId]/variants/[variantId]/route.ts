import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { updateCatalogVariant } from "@acme/core/lib/catalog-lifecycle";
import { variantPatchInput } from "@acme/core/lib/catalog-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string; productId: string; variantId: string }> };

/** Org OWNER/ADMIN only; variant belongs to both requested organization and product. */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const params = await context.params;
    const changes = variantPatchInput.parse(await request.json());
    const variant = await updateCatalogVariant({ userId, ...params, changes });
    return NextResponse.json(variant, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
