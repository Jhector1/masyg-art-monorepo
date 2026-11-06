import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { resolvePublicStoreFromHostHeader } from "@acme/core/lib/storefront-host";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { CHECKOUT_PREPARED_EXPIRED } from "@acme/core/lib/stripe-test-checkout-retry-policy";
import { CartSafetyError } from "@acme/core/lib/cart-contract";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { stripeTestCheckoutEnabled, mixedTestCheckoutEnabledForStore, createDigitalStripeTestCheckout } from "../../../../../../payments/stripe-test-checkout-service";
import { ZodError } from "zod";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
const response=(status:number,data:object)=>Response.json(data,{status,headers});
export async function GET(req:NextRequest,ctx:{params:Promise<{storeId:string}>}) {
  try {
    const {storeId}=await ctx.params;
    const store=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
    if (store.id!==storeId) return response(404,{error:"Not found"});
    const mixedEnabled=await mixedTestCheckoutEnabledForStore(store.organizationId,store.id);
    return response(200,{enabled:stripeTestCheckoutEnabled(),mode:"test",digitalOnly:!mixedEnabled,mixedEnabled});
  } catch {return response(404,{error:"Not found"});}
}
export async function POST(req:NextRequest,ctx:{params:Promise<{storeId:string}>}) {
  try {
    requireSameOriginJson(req);
    if (Number(req.headers.get("content-length")||"0")>4096) return response(413,{error:"Request too large"});
    const raw=await req.text();
    if (raw.length>4096) return response(413,{error:"Request too large"});
    const body:unknown=JSON.parse(raw);
    const {storeId}=await ctx.params;
    const store=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
    if (store.id!==storeId) return response(404,{error:"Not found"});
    const session=await getServerSession(authOptions);
    const userId=session?.user && "id" in session.user && typeof session.user.id==="string"?session.user.id:null;
    const email=session?.user?.email;
    if (!userId || !email) return response(401,{error:"Sign in before checkout"});
    const result=await createDigitalStripeTestCheckout({organizationId:store.organizationId,
      storeId,userId,email,rawCartToken:req.cookies.get(`zd_cart_${storeId}`)?.value,body});
    return response(200,{checkoutUrl:result.url,sessionId:result.providerSessionId,mode:"test"});
  } catch(error) {
    if (error instanceof SyntaxError || error instanceof ZodError || error instanceof CartSafetyError)
      return response(400,{error:"Invalid checkout request"});
    if (error instanceof PublicCatalogError) return response(error.status,{error:"Not found"});
    if (error instanceof CommerceInvariantError) {
      if(error.code===CHECKOUT_PREPARED_EXPIRED)
        return response(409,{error:"Previous checkout expired. Safely released reserved stock; retry checkout.",
          code:CHECKOUT_PREPARED_EXPIRED});
      const unavailable=["CHECKOUT_DISABLED","STRIPE_SECRET_UNAVAILABLE","TAX_CODE_REQUIRED","CHECKOUT_UNAVAILABLE","SHIPPING_NOT_QUOTED"].includes(error.code);
      return response(unavailable?503:409,{error:unavailable?"Test checkout is not configured":error.message});
    }
    console.error("Stripe test checkout failed",error instanceof Error?error.name:"unknown");
    return response(503,{error:"Stripe test checkout unavailable"});
  }
}
