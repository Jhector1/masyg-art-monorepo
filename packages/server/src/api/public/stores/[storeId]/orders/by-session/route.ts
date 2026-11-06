import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { CheckoutSessionAccessError, getBuyerCheckoutSession } from "@acme/core/lib/customer-checkout-session";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { resolvePublicStoreFromHostHeader } from "@acme/core/lib/storefront-host";
import { TenantAccessError } from "@acme/core/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
/** The host is merchant-verified, the session belongs to an authenticated buyer,
 * and the provider session ID is a lookup key, NOT proof of payment.
 */
export async function GET(req:NextRequest, ctx:{params:Promise<{storeId:string}>}) {
  try {
    const session=await getServerSession(authOptions);
    const userId=session?.user && "id" in session.user && typeof session.user.id === "string" ? session.user.id : null;
    if (!userId) return NextResponse.json({error:"Unauthorized"},{status:401,headers});
    const {storeId}=await ctx.params;
    const published=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
    if (published.id!==storeId) return NextResponse.json({error:"Not found"},{status:404,headers});
    const sessionId=req.nextUrl.searchParams.get("session_id") ?? "";
    const result=await getBuyerCheckoutSession({userId,storeId,sessionId});
    return NextResponse.json(result,{headers});
  } catch(error) {
    if (error instanceof CheckoutSessionAccessError || error instanceof TenantAccessError || error instanceof PublicCatalogError)
      return NextResponse.json({error:error.message},{status:error.status,headers});
    console.error("Customer checkout status lookup failed",error);
    return NextResponse.json({error:"Unable to load checkout status"},{status:500,headers});
  }
}
