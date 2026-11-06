import {NextRequest,NextResponse} from "next/server";
import {deleteCustomerAddress} from "@acme/core/lib/customer-addresses";
import {buyerAddressScope,customerAddressFailure,privateHeaders} from "@acme/server/lib/customer-address-route";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function DELETE(req:NextRequest, context:{params:Promise<{id:string}>}) {
  try {
    const principal=await buyerAddressScope(req);
    if (!req.headers.get("origin") || req.headers.get("origin") !== req.nextUrl.origin) {
      return NextResponse.json({error:"Invalid request origin"},{status:403,headers:privateHeaders});
    }
    const {id}=await context.params;
    return NextResponse.json(await deleteCustomerAddress({...principal,addressId:id}),{headers:privateHeaders});
  } catch(error) {return customerAddressFailure(error);}
}
