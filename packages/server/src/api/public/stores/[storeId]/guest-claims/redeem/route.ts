import { NextRequest, NextResponse } from "next/server";
import { redeemGuestPurchaseClaim } from "@acme/core/lib/guest-purchase-claim";
import {
  guestClaimHttpEnabled, disabledClaimResponse, privateClaimHeaders,
  requireClaimUserId, claimStoreId, readClaimRedemption, claimErrorResponse,
} from "@acme/server/lib/guest-claim-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: { params: Promise<{storeId: string}> }) {
  if (!guestClaimHttpEnabled()) return disabledClaimResponse();
  try {
    const userId = await requireClaimUserId();
    const { storeId } = await context.params;
    const canonicalStoreId = claimStoreId(storeId);
    const { code } = await readClaimRedemption(req);
    const result = await redeemGuestPurchaseClaim({ userId, storeId: canonicalStoreId, code });
    return NextResponse.json(result, { headers: privateClaimHeaders });
  } catch (error) { return claimErrorResponse(error); }
}
