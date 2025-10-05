// src/app/api/products/[id]/saveUserDesign/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { getEntitlementSummary, getPurchasedFlag, getPurchasedKinds } from "@acme/core/helpers/stripe/webhook/entitlements";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;

  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const signedIn = !!userId; // ← match OLD behavior

  // Build "who" (prefer user; otherwise guest)
  const who = { userId: userId ?? null, guestId: userId ? null : (guestId ?? null) };

  // If neither user nor guest, behave like old route: sign-in required
  if (!who.userId && !who.guestId) {
    return NextResponse.json({
      signedIn,
      purchased: false,
      canExport: false,
      reason: "signin_required",
      exportQuota: 0,
      exportsUsed: 0,
      exportsLeft: 0,
         purchasedKinds: [],
      purchasedDigital: false,
      purchasedPrint: false,
    });
  }

   const [summary, purchased, kinds] = await Promise.all([
    getEntitlementSummary(who, productId),
    getPurchasedFlag(who, productId),
    getPurchasedKinds(who, productId),  // ← new
  ]);
  const purchasedDigital = kinds.includes("DIGITAL");
  const purchasedPrint = kinds.includes("PRINT");
  const canExport = signedIn && purchased && summary.exportsLeft > 0;
  const reason = canExport
    ? null
    : !signedIn
    ? "signin_required"
    : !purchased
    ? "not_purchased"
    : summary.exportsLeft <= 0
    ? "quota_exhausted"
    : null;
console.log(purchasedDigital,purchasedPrint, kinds)
  return NextResponse.json({
    signedIn,
    purchased,
    canExport,
    reason,
    exportQuota: summary.exportQuota,
    exportsUsed: summary.exportsUsed,
    exportsLeft: summary.exportsLeft,
      // NEW (non-breaking additions)
    purchasedKinds: kinds,     // ["DIGITAL"], ["PRINT"], or ["DIGITAL","PRINT"]
    purchasedDigital,
    purchasedPrint,
  });
}
