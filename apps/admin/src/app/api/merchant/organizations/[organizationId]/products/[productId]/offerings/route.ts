import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { getMerchantOfferings, createMerchantOffering, updateMerchantOffering, assignMerchantVariantOffering } from "@acme/core/lib/merchant-offerings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const kind = z.enum(["ORIGINAL", "PRINT", "DOWNLOAD", "MERCHANDISE"]);
const mutation = z.discriminatedUnion("action", [
  z.object({action:z.literal("create"),kind,name:z.string().min(2).max(100)}).strict(),
  z.object({action:z.literal("update"),offeringId:z.string(),kind,name:z.string().min(2).max(100)}).strict(),
  z.object({action:z.literal("assign"),offeringId:z.string(),variantId:z.string()}).strict(),
]);
type Ctx = { params: Promise<{organizationId:string;productId:string}> };

export async function GET(request:NextRequest, ctx:Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const {organizationId,productId} = await ctx.params;
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) return NextResponse.json({error:"Store context required"},{status:400});
    const result = await getMerchantOfferings({userId,organizationId,productId,storeId});
    return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) { return merchantHttpError(error); }
}
export async function POST(request:NextRequest, ctx:Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const {organizationId,productId} = await ctx.params;
    const input = mutation.parse(await request.json());
    let result;
    if (input.action === "create") result = await createMerchantOffering({userId,organizationId,productId,kind:input.kind,name:input.name});
    else if (input.action === "update") result = await updateMerchantOffering({userId,organizationId,productId,offeringId:input.offeringId,kind:input.kind,name:input.name});
    else result = await assignMerchantVariantOffering({userId,organizationId,productId,offeringId:input.offeringId,variantId:input.variantId});
    return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"},status:input.action === "create" ? 201 : 200});
  } catch (error) { return merchantHttpError(error); }
}
