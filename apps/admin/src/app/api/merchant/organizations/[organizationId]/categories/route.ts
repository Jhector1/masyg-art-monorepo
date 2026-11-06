import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { listMerchantCategories, createMerchantCategory } from "@acme/core/lib/merchant-categories";
type Ctx = { params: Promise<{ organizationId: string }> };
export async function GET(_req: NextRequest, ctx: Ctx) {
  try { const userId = await requireMerchantPrincipal(); const { organizationId } = await ctx.params;
    return NextResponse.json(await listMerchantCategories(userId, organizationId), { headers: { "Cache-Control": "private, no-store" } });
  } catch(e) { return merchantHttpError(e); }
}
export async function POST(req: NextRequest, ctx: Ctx) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId } = await ctx.params;
    return NextResponse.json(await createMerchantCategory(userId, organizationId, await req.json()), { status: 201 });
  } catch(e) { return merchantHttpError(e); }
}
