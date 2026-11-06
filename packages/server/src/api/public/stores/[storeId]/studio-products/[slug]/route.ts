import { NextRequest, NextResponse } from "next/server";
import { getPublishedStudioProduct } from "@acme/core/lib/storefront-studio-product";
import { resolvePublicStoreFromHostHeader } from "@acme/core/lib/storefront-host";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { TenantAccessError } from "@acme/core/lib/tenancy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(req:NextRequest,ctx:{params:Promise<{storeId:string;slug:string}>}) {
  try {
    const {storeId,slug}=await ctx.params;
    const verified=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
    if(verified.id!==storeId)return NextResponse.json({error:"Not found"},{status:404,headers});
    const data=await getPublishedStudioProduct(storeId,slug);
    return NextResponse.json(data,{headers});
  } catch(err) {
    if(err instanceof PublicCatalogError || err instanceof TenantAccessError)
      return NextResponse.json({error:err.message},{status:err.status,headers});
    console.error("Studio public product read failed",err);
    return NextResponse.json({error:"Studio product unavailable"},{status:500,headers});
  }
}
