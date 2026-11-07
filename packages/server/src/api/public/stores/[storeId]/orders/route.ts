import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { CustomerOrderAccessError, listCustomerOrders } from "@acme/core/lib/customer-orders";
import { TenantAccessError } from "@acme/core/lib/tenancy";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { resolvePublicStoreFromHostHeader } from "@acme/core/lib/storefront-host";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request, context:{params:Promise<{storeId:string}>}) {
  const noStore={"Cache-Control":"private, no-store","Vary":"Cookie"};
  try {
    const session=await getServerSession(authOptions);
    const userId=session?.user && "id" in session.user && typeof session.user.id === "string" ? session.user.id : null;
    if (!userId) return NextResponse.json({error:"Unauthorized"},{status:401,headers:noStore});
    const {storeId}=await context.params;
    const verified=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
    if (verified.id!==storeId) return NextResponse.json({error:"Not found"},{status:404,headers:noStore});
    const orders=await listCustomerOrders({userId,storeId});
    return NextResponse.json(orders,{headers:noStore});
  } catch(error) {
    if (error instanceof CustomerOrderAccessError || error instanceof TenantAccessError || error instanceof PublicCatalogError) {
      return NextResponse.json({error:error.message},{status:error.status,headers:noStore});
    }
    console.error("Customer order listing failed",error);
    return NextResponse.json({error:"Unable to list orders"},{status:500,headers:noStore});
  }
}
