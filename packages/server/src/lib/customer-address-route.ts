import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { resolvePublicStoreFromHostHeader } from "@acme/core/lib/storefront-host";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { CustomerAddressAccessError } from "@acme/core/lib/customer-addresses";

export const privateHeaders={"Cache-Control":"private, no-store", "Vary":"Cookie"};

export async function buyerAddressScope(req:NextRequest) {
  const session=await getServerSession(authOptions);
  const userId=session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id : null;
  if (!userId) throw new CustomerAddressAccessError(401,"Unauthorized");
  // Never trust x-storefront, the query string, or a user supplied merchant ID.
  const store=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
  return {userId,storeId:store.id};
}

export function customerAddressFailure(error:unknown) {
  if (error instanceof CustomerAddressAccessError || error instanceof PublicCatalogError) {
    return NextResponse.json({error:error.message},{status:error.status,headers:privateHeaders});
  }
  if (error instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON"},{status:400,headers:privateHeaders});
  console.error("Buyer saved address operation failed",error);
  return NextResponse.json({error:"Unable to process addresses"},{status:500,headers:privateHeaders});
}
