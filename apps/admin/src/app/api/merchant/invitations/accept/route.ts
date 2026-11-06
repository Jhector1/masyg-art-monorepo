import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { acceptMerchantInvitation } from "@acme/core/lib/merchant-invitations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal();
    return NextResponse.json(await acceptMerchantInvitation(userId, await request.json()), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
