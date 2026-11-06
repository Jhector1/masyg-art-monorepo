import { NextRequest, NextResponse } from "next/server";
import { CartSafetyError } from "@acme/core/lib/cart-contract";
import { getGuestCart, mutateGuestCart } from "@acme/core/lib/cart-service";
import { PublicCatalogError, requirePublicStoreId } from "@acme/core/lib/public-catalog";
import { ZodError } from "zod";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = {"Cache-Control":"no-store"};
const cookieName = (storeId:string) => `zd_cart_${requirePublicStoreId(storeId)}`;
function sendError(error:unknown) {
  if (error instanceof PublicCatalogError || error instanceof CartSafetyError) {
    return NextResponse.json({error:error.message},{status:error.status,headers:noStore});
  }
  if (error instanceof ZodError) return NextResponse.json({error:"Invalid cart payload"},{status:400,headers:noStore});
  console.error("Cart handler failed",error);
  return NextResponse.json({error:"Cart request failed"},{status:500,headers:noStore});
}
async function change(req:NextRequest,context:{params:Promise<{storeId:string}>},mode:"add"|"set") {
  try {
    requireSameOriginJson(req);
    const {storeId}=await context.params;
    const name=cookieName(storeId);
    const raw=await req.text();
    if (raw.length>4096) throw new CartSafetyError(400,"Cart payload too large");
    let payload:unknown;
    try {payload=JSON.parse(raw)} catch {throw new CartSafetyError(400,"Invalid JSON")}
    const result=await mutateGuestCart({storeId,rawToken:req.cookies.get(name)?.value,payload,mode});
    const response=NextResponse.json(result.cart,{headers:noStore});
    if(result.newToken){
      response.cookies.set(name,result.newToken,{
        httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:`/api/public/stores/${storeId}`,maxAge:60*60*24*14,
      });
    }
    return response;
  } catch(error) {return sendError(error)}
}
export async function GET(req:NextRequest,context:{params:Promise<{storeId:string}>}) {
  try {
    const {storeId}=await context.params;
    const data=await getGuestCart({storeId,rawToken:req.cookies.get(cookieName(storeId))?.value});
    return NextResponse.json(data,{headers:noStore});
  } catch(error) {return sendError(error)}
}
export async function POST(req:NextRequest,context:{params:Promise<{storeId:string}>}) {
  return change(req,context,"add");
}
export async function PUT(req:NextRequest,context:{params:Promise<{storeId:string}>}) {
  return change(req,context,"set");
}
