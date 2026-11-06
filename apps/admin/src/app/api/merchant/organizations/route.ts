import { NextRequest, NextResponse } from "next/server";
import { provisionMerchantStore, listMerchantOrganizations, validateSlug } from "@acme/core/lib/tenancy";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { prisma } from "@acme/core/lib/prisma";
import { requiresMerchantEmailVerification } from "@acme/core/lib/merchant-email-policy";
import { merchantHttpError, parseMerchantBody, badRequest } from "@/lib/merchant-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const userId = await requireMerchantPrincipal();
    const memberships = await listMerchantOrganizations(userId);
    return NextResponse.json(memberships, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
export async function POST(req: NextRequest) {
  if (process.env.MERCHANT_PROVISIONING_ENABLED !== "true") {
    return NextResponse.json({ error: "Merchant provisioning is not enabled" }, { status: 503 });
  }
  try {
    const userId = await requireMerchantPrincipal();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
    if (requiresMerchantEmailVerification(process.env.MERCHANT_EMAIL_VERIFICATION_REQUIRED) && !user?.emailVerified)
      return NextResponse.json({ error: "Verify your email before creating a store" }, { status: 403 });
    if (await prisma.organizationMember.findFirst({ where: { userId }, select: { userId: true } })) {
      return NextResponse.json({ error: "You already belong to an organization. Create additional stores there or accept an invitation." }, { status: 409 });
    }
    const body = parseMerchantBody(await req.json());
    validateSlug(body.organizationSlug);
    validateSlug(body.storeSlug);
    if (body.organizationName.trim().length < 1 || body.organizationName.length > 120 ||
        body.storeName.trim().length < 1 || body.storeName.length > 120) return badRequest();
    const { organization, store } = await provisionMerchantStore({ verifiedUserId: userId, ...body });
    return NextResponse.json({ organizationId: organization.id, storeId: store.id },
      { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error && /Invalid|Missing/.test(error.message)) return badRequest();
    return merchantHttpError(error);
  }
}
