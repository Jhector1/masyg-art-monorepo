import { NextRequest, NextResponse } from "next/server";

import { stripe } from "@acme/core/lib/stripe";
import { requireUser } from "@acme/core/utils/requireUser";
import {
  handleQuotaTopup,
  isQuotaTopup,
} from "@acme/core/helpers/stripe/webhook/quota";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sessionId = String(body?.sessionId ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  const user = await requireUser();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // A browser may only reconcile its own paid top-up. This endpoint is a
  // recovery path; the signed Stripe webhook remains the primary authority.
  if (session.metadata?.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { applied: false, reason: "not_paid" },
      { status: 200 }
    );
  }
  if (!isQuotaTopup(session)) {
    return NextResponse.json(
      { applied: false, reason: "not_quota_topup" },
      { status: 200 }
    );
  }

  try {
    const result = await handleQuotaTopup(session);
    return NextResponse.json(
      {
        applied: result.applied || result.deduped,
        deduped: result.deduped,
        units: result.units,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("apply-quota error:", error?.message || error);
    return NextResponse.json(
      { applied: false, error: "apply_failed" },
      { status: 500 }
    );
  }
}
