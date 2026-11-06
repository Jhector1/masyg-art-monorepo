import { NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantIdentity } from "@/lib/merchant-session";
import { merchantSecurityError } from "@/lib/merchant-mfa-http";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { userId } = await requireMerchantIdentity();
    const row = await prisma.merchantMfaCredential.findUnique({ where: { userId }, select: { enabledAt: true, pendingExpiresAt: true } });
    return NextResponse.json({ enabled: !!row?.enabledAt,
      pending: !row?.enabledAt && !!row?.pendingExpiresAt && row.pendingExpiresAt > new Date() },
      { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return merchantSecurityError(e); }
}
