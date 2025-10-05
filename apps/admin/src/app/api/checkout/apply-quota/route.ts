import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@acme/core/lib/stripe";
import { handleQuotaTopup, isQuotaTopup } from "@acme/core/helpers/stripe/webhook/quota";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return NextResponse.json({ applied: false, reason: "not_paid" }, { status: 200 });
  }
  if (!isQuotaTopup(session)) {
    return NextResponse.json({ applied: false, reason: "not_quota_topup" }, { status: 200 });
  }

  try {
    await handleQuotaTopup(session);
    // If it was already applied, our handler just no-ops. Still OK to report success.
    return NextResponse.json({ applied: true }, { status: 200 });
  } catch (e: any) {
    console.error("apply-quota error:", e?.message || e);
    return NextResponse.json({ applied: false, error: "apply_failed" }, { status: 500 });
  }
}
