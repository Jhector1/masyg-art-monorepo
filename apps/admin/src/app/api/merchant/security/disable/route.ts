import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { disableMerchantMfa } from "@/lib/merchant-mfa-service";
import { merchantSecurityError } from "@/lib/merchant-mfa-http";
import { jsonBody } from "@/lib/merchant-auth-request";
import { clearMerchantMfaCookie } from "@/lib/merchant-mfa-cookie";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = z.object({ code: z.string().min(6).max(20), confirm: z.literal("DISABLE") }).strict().parse(await jsonBody(req));
    const userId = await requireMerchantPrincipal();
    await disableMerchantMfa(userId, body.code);
    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    clearMerchantMfaCookie(res);
    return res;
  } catch (e) { return merchantSecurityError(e); }
}
