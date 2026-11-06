import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { planMerchantShipment } from "@acme/core/lib/merchant-shipment-plans";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string; storeId: string; orderId: string }> };
export async function POST(request: NextRequest, ctx: Ctx) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId, storeId, orderId } = await ctx.params;
    return NextResponse.json(await planMerchantShipment({ userId, organizationId, storeId, orderId, body: await request.json() }), { status: 201 });
  } catch (error) { return merchantHttpError(error); }
}
