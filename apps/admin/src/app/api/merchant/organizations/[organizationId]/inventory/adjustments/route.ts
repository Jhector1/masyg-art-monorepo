import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { adjustMerchantStock } from "@acme/core/lib/merchant-inventory";
type Ctx = { params: Promise<{ organizationId: string }> };
export async function POST(req: NextRequest, ctx: Ctx) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId } = await ctx.params;
    return NextResponse.json(await adjustMerchantStock({ userId, organizationId, body: await req.json() }));
  } catch(e) { return merchantHttpError(e); }
}
