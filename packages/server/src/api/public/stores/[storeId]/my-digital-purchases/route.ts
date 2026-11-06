import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { BuyerDigitalAccessError, listBuyerDigitalEntitlements } from "@acme/core/lib/buyer-digital-entitlements";
import { TenantAccessError } from "@acme/core/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "Vary": "Cookie" };

/** Read-only catalog for an authenticated owner of a settled order.
 * Deliberately no claim, download URL, file proxy, token, or guest access.
 */
export async function GET(_req: Request, context: { params: Promise<{ storeId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id : null;
    const { storeId } = await context.params;
    const result = await listBuyerDigitalEntitlements({ userId, storeId });
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof BuyerDigitalAccessError || error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
    }
    console.error("Digital purchase catalog failed", error);
    return NextResponse.json({ error: "Unable to list digital purchases" }, { status: 500, headers: privateHeaders });
  }
}
