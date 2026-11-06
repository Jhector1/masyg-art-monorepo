import { NextRequest, NextResponse } from "next/server";
import { createMerchantStore, listMerchantStores, validateSlug } from "@acme/core/lib/tenancy";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError, badRequest } from "@/lib/merchant-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string }> };
export async function GET(_: NextRequest, context: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId } = await context.params;
    const stores = await listMerchantStores({ userId, organizationId });
    return NextResponse.json(stores, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
export async function POST(req: NextRequest, context: Ctx) {
  if (process.env.MERCHANT_PROVISIONING_ENABLED !== "true") {
    return NextResponse.json({ error: "Merchant provisioning is not enabled" }, { status: 503 });
  }
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId } = await context.params;
    const body = await req.json() as { name?: unknown; slug?: unknown };
    if (typeof body?.name !== "string" || typeof body?.slug !== "string" ||
        body.name.trim().length < 1 || body.name.length > 120) return badRequest();
    validateSlug(body.slug);
    const store = await createMerchantStore({ verifiedUserId: userId, organizationId, name: body.name, slug: body.slug });
    return NextResponse.json({ id: store.id, slug: store.slug, name: store.name },
      { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error && /Invalid/.test(error.message)) return badRequest();
    return merchantHttpError(error);
  }
}
