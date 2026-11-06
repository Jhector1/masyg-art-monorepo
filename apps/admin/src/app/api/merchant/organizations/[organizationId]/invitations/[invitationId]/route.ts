import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { revokeMerchantInvitation } from "@acme/core/lib/merchant-invitations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string; invitationId: string }> };
export async function DELETE(request: NextRequest, ctx: Ctx) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const actor = await requireMerchantPrincipal(); const { organizationId, invitationId } = await ctx.params;
    return NextResponse.json(await revokeMerchantInvitation(actor, organizationId, invitationId));
  } catch (error) { return merchantHttpError(error); }
}
