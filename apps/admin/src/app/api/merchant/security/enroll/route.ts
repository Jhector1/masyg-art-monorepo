import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantIdentity } from "@/lib/merchant-session";
import { beginMerchantMfaEnrollment } from "@/lib/merchant-mfa-service";
import { merchantSecurityError } from "@/lib/merchant-mfa-http";
import { requireLocalJson } from "@/lib/merchant-auth-request";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    requireLocalJson(req);
    const { userId } = await requireMerchantIdentity();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const enrollment = await beginMerchantMfaEnrollment(userId, user.email);
    return NextResponse.json(enrollment, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return merchantSecurityError(e); }
}
