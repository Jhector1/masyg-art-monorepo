import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { listMerchantStaff, addMerchantStaff } from "@acme/core/lib/merchant-staff";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string }> };
export async function GET(_request: NextRequest, ctx: Ctx) {
  try { const userId = await requireMerchantPrincipal(); const { organizationId } = await ctx.params;
    return NextResponse.json(await listMerchantStaff(userId, organizationId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return merchantHttpError(e); }
}
export async function POST(request: NextRequest, ctx: Ctx) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId } = await ctx.params;
    return NextResponse.json(await addMerchantStaff(userId, organizationId, await request.json()), { status: 201 });
  } catch (e) { return merchantHttpError(e); }
}
