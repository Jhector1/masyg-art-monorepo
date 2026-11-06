import {NextRequest,NextResponse} from "next/server";
import {listCustomerAddresses,createCustomerAddress} from "@acme/core/lib/customer-addresses";
import {buyerAddressScope,customerAddressFailure,privateHeaders} from "@acme/server/lib/customer-address-route";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  try {
    return NextResponse.json(await listCustomerAddresses(await buyerAddressScope(req)),{headers:privateHeaders});
  } catch(error) {return customerAddressFailure(error);}
}
export async function POST(req:NextRequest) {
  try {
    const principal=await buyerAddressScope(req);
    // Cookie-authenticated write. Browser must send exactly the same origin.
    if (!req.headers.get("origin") || req.headers.get("origin") !== req.nextUrl.origin) {
      return NextResponse.json({error:"Invalid request origin"},{status:403,headers:privateHeaders});
    }
    if (req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      return NextResponse.json({error:"Expected JSON"},{status:400,headers:privateHeaders});
    }
    const raw=await req.text();
    if (raw.length>4096) return NextResponse.json({error:"Address too large"},{status:400,headers:privateHeaders});
    const input:unknown=JSON.parse(raw);
    return NextResponse.json(await createCustomerAddress({...principal,input}),{headers:privateHeaders});
  } catch(error) {return customerAddressFailure(error);}
}
