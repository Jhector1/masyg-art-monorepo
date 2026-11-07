import type {NextRequest} from "next/server";
import {authorizedCommerceCron} from "../../../../lib/commerce-cron-auth";
import {reconcileLostStripeTestPayments} from "../../../../payments/stripe-test-recovery-job";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
/** Scheduler-only, TEST-only and local DB-bound provider reconciliation. */
export async function POST(req:NextRequest) {
  if(!authorizedCommerceCron(req.headers.get("authorization"),
      process.env.ZILEDIGITAL_COMMERCE_CRON_SECRET))
    return Response.json({error:"Unauthorized"},{status:401,headers});
  try {
    const summary=await reconcileLostStripeTestPayments(10);
    return Response.json(summary,{status:summary.errors || summary.providerUnavailable ? 503 : 200,headers});
  } catch(error) {
    console.error("Stripe TEST checkout recovery unavailable",
      error instanceof Error?error.name:"unknown");
    return Response.json({error:"Checkout recovery unavailable"},{status:503,headers});
  }
}
