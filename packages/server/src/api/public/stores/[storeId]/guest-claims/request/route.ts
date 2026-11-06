import { NextRequest, NextResponse } from "next/server";
import { requestGuestPurchaseClaim } from "@acme/core/lib/guest-purchase-claim";
import {
  guestClaimHttpEnabled, smtpIsConfigured, disabledClaimResponse,
  privateClaimHeaders, requireClaimUserId, claimStoreId,
  readClaimRequest, claimErrorResponse,
} from "@acme/server/lib/guest-claim-http";
import { deliverGuestClaimCode } from "@acme/server/lib/smtp-guest-claim-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Feature-gated until authenticated edge IP/device rate limiting is deployed.
 * Same response whether the order exists or is eligible; no raw token is returned.
 */
export async function POST(req: NextRequest, context: { params: Promise<{storeId: string}> }) {
  if (!guestClaimHttpEnabled() || !smtpIsConfigured()) return disabledClaimResponse();
  try {
    const userId = await requireClaimUserId();
    const { storeId } = await context.params;
    const canonicalStoreId = claimStoreId(storeId);
    const { orderId } = await readClaimRequest(req);
    await requestGuestPurchaseClaim({
      userId, storeId: canonicalStoreId, orderId, deliver: deliverGuestClaimCode,
    });
    return NextResponse.json({ accepted: true }, { status: 202, headers: privateClaimHeaders });
  } catch (error) { return claimErrorResponse(error); }
}
