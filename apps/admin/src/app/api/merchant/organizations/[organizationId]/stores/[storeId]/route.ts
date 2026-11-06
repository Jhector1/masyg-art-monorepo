import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { merchantHttpError } from "@/lib/merchant-http";
import { setMerchantStorePublished } from "@acme/core/lib/store-publication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };
const publicationInput = z.object({ published: z.boolean() }).strict();

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const params = await ctx.params;
    const input = publicationInput.parse(await req.json());
    return NextResponse.json(await setMerchantStorePublished({ userId, ...params, ...input }),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return merchantHttpError(error); }
}
