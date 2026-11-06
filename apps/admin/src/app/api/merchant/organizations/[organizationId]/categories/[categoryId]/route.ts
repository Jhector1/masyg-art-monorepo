import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { updateMerchantCategory, removeMerchantCategory } from "@acme/core/lib/merchant-categories";
type Ctx = { params: Promise<{ organizationId: string; categoryId: string }> };
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId, categoryId } = await ctx.params;
    return NextResponse.json(await updateMerchantCategory(userId, organizationId, categoryId, await req.json()));
  } catch(e) { return merchantHttpError(e); }
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId, categoryId } = await ctx.params;
    return NextResponse.json(await removeMerchantCategory(userId, organizationId, categoryId));
  } catch(e) { return merchantHttpError(e); }
}
