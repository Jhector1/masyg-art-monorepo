import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { updateMerchantStaffRole, removeMerchantStaff } from "@acme/core/lib/merchant-staff";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string; userId: string }> };
function sameOrigin(req: NextRequest) { return req.headers.get("origin") === req.nextUrl.origin; }
export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const actorId = await requireMerchantPrincipal(); const { organizationId, userId } = await ctx.params;
    return NextResponse.json(await updateMerchantStaffRole(actorId, organizationId, userId, await request.json()));
  } catch (e) { return merchantHttpError(e); }
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const actorId = await requireMerchantPrincipal(); const { organizationId, userId } = await ctx.params;
    return NextResponse.json(await removeMerchantStaff(actorId, organizationId, userId));
  } catch (e) { return merchantHttpError(e); }
}
