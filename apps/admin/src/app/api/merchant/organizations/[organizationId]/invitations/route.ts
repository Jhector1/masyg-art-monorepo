import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { listMerchantInvitations, createMerchantInvitation, recordInvitationDelivery } from "@acme/core/lib/merchant-invitations";
import { invitationMailConfig, sendMerchantInviteEmail } from "@/lib/merchant-invite-delivery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string }> };
export async function GET(_request: NextRequest, ctx: Ctx) {
  try { const actor = await requireMerchantPrincipal(); const { organizationId } = await ctx.params;
    return NextResponse.json(await listMerchantInvitations(actor, organizationId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
export async function POST(request: NextRequest, ctx: Ctx) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try {
    // Fail before creating a token if outbound mail is not configured.
    invitationMailConfig();
    const actor = await requireMerchantPrincipal(); const { organizationId } = await ctx.params;
    const invite = await createMerchantInvitation(actor, organizationId, await request.json());
    try {
      const providerMessageId = await sendMerchantInviteEmail({ invitationId: invite.invitationId, token: invite.token,
        email: invite.email, role: invite.role as "ADMIN" | "MEMBER" });
      await recordInvitationDelivery(invite.invitationId, true, providerMessageId);
    } catch {
      await recordInvitationDelivery(invite.invitationId, false).catch(() => undefined);
      return NextResponse.json({ error: "Invitation email was not confirmed. No access was granted; retry after checking email settings." }, { status: 502 });
    }
    return NextResponse.json({ id: invite.invitationId, deliveryStatus: "SENT" }, { status: 201,
      headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
