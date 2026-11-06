import {timingSafeEqual} from "node:crypto";
import type {NextRequest} from "next/server";
import {expirePreparedCheckouts} from "../../../../payments/expire-prepared-checkouts";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
/** Only a trusted scheduler may release expired UN-SUBMITTED checkouts. */
export async function POST(req:NextRequest) {
  const expected=process.env.ZILEDIGITAL_COMMERCE_CRON_SECRET??"";
  const supplied=req.headers.get("authorization")??"";
  const expectedBytes=Buffer.from(`Bearer ${expected}`);
  const suppliedBytes=Buffer.from(supplied);
  if(expected.length<32 || expectedBytes.length!==suppliedBytes.length ||
      !timingSafeEqual(expectedBytes,suppliedBytes))
    return Response.json({error:"Unauthorized"},{status:401,headers});
  try {
    const summary=await expirePreparedCheckouts(50);
    return Response.json(summary,{status:summary.errors?503:200,headers});
  } catch(error) {
    console.error("Prepared checkout expiry failed",error instanceof Error?error.name:"unknown");
    return Response.json({error:"Checkout maintenance unavailable"},{status:503,headers});
  }
}
