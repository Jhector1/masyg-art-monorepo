import { NextRequest, NextResponse } from "next/server";
import { getCheckoutPreflight } from "@acme/core/lib/checkout-preflight";
import { CartSafetyError } from "@acme/core/lib/cart-contract";
import { PublicCatalogError, requirePublicStoreId } from "@acme/core/lib/public-catalog";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = {"Cache-Control":"no-store"};
const cookieName = (storeId:string) => `zd_cart_${requirePublicStoreId(storeId)}`;
function errorResponse(error:unknown) {
  if (error instanceof PublicCatalogError || error instanceof CartSafetyError) {
    return NextResponse.json({error:error.message},{status:error.status,headers:noStore});
  }
  if (error instanceof ZodError) {
    return NextResponse.json({error:"Invalid checkout contact"},{status:400,headers:noStore});
  }
  console.error("Checkout preflight failed",error);
  return NextResponse.json({error:"Checkout preflight unavailable"},{status:500,headers:noStore});
}
async function preflight(req:NextRequest,context:{params:Promise<{storeId:string}>},contact?:unknown) {
  try {
    const {storeId}=await context.params;
    const result=await getCheckoutPreflight({storeId,rawToken:req.cookies.get(cookieName(storeId))?.value,contact});
    return NextResponse.json(result,{headers:noStore});
  } catch(error) {return errorResponse(error)}
}
export async function GET(req:NextRequest,context:{params:Promise<{storeId:string}>}) {
  return preflight(req,context);
}
/** POST is read-only, accepts contact solely to report outstanding blockers. */
export async function POST(req:NextRequest,context:{params:Promise<{storeId:string}>}) {
  try {
    requireSameOriginJson(req);
    const text = await req.text();
    if (text.length > 4096) throw new CartSafetyError(400,"Checkout contact payload too large");
    let contact:unknown;
    try {contact=JSON.parse(text)} catch {throw new CartSafetyError(400,"Invalid JSON")}
    return preflight(req,context,contact);
  } catch(error) {return errorResponse(error)}
}
