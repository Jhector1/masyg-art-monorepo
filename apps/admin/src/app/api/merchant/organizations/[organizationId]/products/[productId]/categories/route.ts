import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { setMerchantProductCategories } from "@acme/core/lib/merchant-categories";
type Ctx = { params: Promise<{ organizationId: string; productId: string }> };
export async function PUT(req: NextRequest, ctx: Ctx) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId, productId } = await ctx.params;
    return NextResponse.json(await setMerchantProductCategories({ userId, organizationId, productId, body: await req.json() }));
  } catch(e) { return merchantHttpError(e); }
}
