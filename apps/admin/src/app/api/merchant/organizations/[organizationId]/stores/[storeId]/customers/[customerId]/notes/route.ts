import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { listMerchantCustomerNotes, addMerchantCustomerNote } from "@acme/core/lib/merchant-customer-notes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string; storeId: string; customerId: string }> };
export async function GET(_request: NextRequest, ctx: Ctx) {
  try { const userId = await requireMerchantPrincipal(); const { organizationId, storeId, customerId } = await ctx.params;
    return NextResponse.json(await listMerchantCustomerNotes({ userId, organizationId, storeId, customerId }),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
export async function POST(request: NextRequest, ctx: Ctx) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  try { const userId = await requireMerchantPrincipal(); const { organizationId, storeId, customerId } = await ctx.params;
    return NextResponse.json(await addMerchantCustomerNote({ userId, organizationId, storeId, customerId, body: await request.json() }), { status: 201 });
  } catch (error) { return merchantHttpError(error); }
}
