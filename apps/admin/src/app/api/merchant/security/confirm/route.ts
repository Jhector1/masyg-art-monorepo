import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchantIdentity } from "@/lib/merchant-session";
import { finishMerchantMfaEnrollment } from "@/lib/merchant-mfa-service";
import { merchantSecurityError } from "@/lib/merchant-mfa-http";
import { jsonBody } from "@/lib/merchant-auth-request";
import { signMerchantMfaCookie, writeMerchantMfaCookie } from "@/lib/merchant-mfa-cookie";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = z.object({ code: z.string().regex(/^\d{6}$/) }).strict().parse(await jsonBody(req));
    const { userId, sessionId } = await requireMerchantIdentity();
    const finished = await finishMerchantMfaEnrollment(userId, body.code);
    const res = NextResponse.json({ ok: true, recoveryCodes: finished.recoveryCodes }, { headers: { "Cache-Control": "no-store" } });
    writeMerchantMfaCookie(res, await signMerchantMfaCookie(userId, finished.version, sessionId));
    return res;
  } catch (e) { return merchantSecurityError(e); }
}
