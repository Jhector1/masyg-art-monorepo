import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { CustomerOrderAccessError, getCustomerOrder } from "@acme/core/lib/customer-orders";
import { TenantAccessError } from "@acme/core/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(_req:Request, context:{params:Promise<{storeId:string;orderId:string}>}) {
  try {
    const session=await getServerSession(authOptions);
    const userId=session?.user && "id" in session.user && typeof session.user.id==="string" ? session.user.id : null;
    const {storeId,orderId}=await context.params;
    const result=await getCustomerOrder({userId,storeId,orderId});
    return NextResponse.json(result,{headers});
  } catch(error) {
    if(error instanceof CustomerOrderAccessError || error instanceof TenantAccessError) {
      return NextResponse.json({error:error.message},{status:error.status,headers});
    }
    console.error("Customer order detail failed",error);
    return NextResponse.json({error:"Unable to load order"},{status:500,headers});
  }
}
