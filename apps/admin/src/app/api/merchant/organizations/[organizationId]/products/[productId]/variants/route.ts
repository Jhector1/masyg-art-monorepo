import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { createCatalogVariant } from "@acme/core/lib/catalog-lifecycle";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = {params:Promise<{organizationId:string;productId:string}>};
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const userId=await requireMerchantPrincipal();
    const {organizationId,productId}=await ctx.params;
    const result=await createCatalogVariant({userId,organizationId,productId,input:await request.json()});
    return NextResponse.json(result,{status:201,headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {return merchantHttpError(error);}
}
