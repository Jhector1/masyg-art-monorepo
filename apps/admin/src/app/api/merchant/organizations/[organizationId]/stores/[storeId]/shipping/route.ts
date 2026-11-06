import { NextRequest, NextResponse } from "next/server";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { readMerchantShippingSettings, saveMerchantShippingSettings } from "@acme/core/lib/merchant-shipping-configuration";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
type Ctx={params:Promise<{organizationId:string;storeId:string}>};
export async function GET(_request:NextRequest, ctx:Ctx) {
  try {
    const userId=await requireMerchantPrincipal();
    return NextResponse.json(await readMerchantShippingSettings({userId,...(await ctx.params)}),{headers});
  } catch(error) { return merchantHttpError(error); }
}
export async function PUT(request:NextRequest, ctx:Ctx) {
  try {
    const callerOrigin=request.headers.get("origin");
    if (!callerOrigin || callerOrigin!==new URL(request.url).origin ||
        !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return NextResponse.json({error:"Same-origin JSON request required"},{status:403,headers});
    const userId=await requireMerchantPrincipal();
    if(Number(request.headers.get("content-length")||"0")>16000)
      return NextResponse.json({error:"Request too large"},{status:413,headers});
    const raw=await request.text();
    if(raw.length>16000) return NextResponse.json({error:"Request too large"},{status:413,headers});
    return NextResponse.json(await saveMerchantShippingSettings({userId,...(await ctx.params),body:JSON.parse(raw)}),{headers});
  } catch(error) { return merchantHttpError(error); }
}
