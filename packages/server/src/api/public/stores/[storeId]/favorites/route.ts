import {NextRequest,NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "@acme/core/lib/auth";
import {resolvePublicStoreFromHostHeader} from "@acme/core/lib/storefront-host";
import {PublicCatalogError} from "@acme/core/lib/public-catalog";
import {StoreFavoriteAccessError,listBuyerStoreFavorites,setBuyerStoreFavorite} from "@acme/core/lib/store-favorites";
import {TenantAccessError} from "@acme/core/lib/tenancy";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
async function buyerScope(req:NextRequest,context:{params:Promise<{storeId:string}>}) {
  const {storeId}=await context.params;
  const verified=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
  if (verified.id!==storeId) throw new StoreFavoriteAccessError(404);
  const session=await getServerSession(authOptions);
  const userId=session?.user && "id" in session.user && typeof session.user.id==="string"?session.user.id:null;
  return {storeId:verified.id,userId};
}
function fail(error:unknown) {
  if(error instanceof StoreFavoriteAccessError || error instanceof PublicCatalogError || error instanceof TenantAccessError)
    return NextResponse.json({error:error.message},{status:error.status,headers});
  if(error instanceof SyntaxError)return NextResponse.json({error:"Invalid JSON"},{status:400,headers});
  console.error("Store favorites failed",error);
  return NextResponse.json({error:"Unable to manage favorites"},{status:500,headers});
}
export async function GET(req:NextRequest,context:{params:Promise<{storeId:string}>}) {
  try{return NextResponse.json(await listBuyerStoreFavorites(await buyerScope(req,context)),{headers});}
  catch(error){return fail(error);}
}
async function change(req:NextRequest,context:{params:Promise<{storeId:string}>},enabled:boolean) {
  try {
    const scope=await buyerScope(req,context);
    if(!req.headers.get("origin") || req.headers.get("origin")!==req.nextUrl.origin)
      return NextResponse.json({error:"Invalid origin"},{status:403,headers});
    if(req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")
      return NextResponse.json({error:"Expected JSON"},{status:400,headers});
    const raw=await req.text();
    if(raw.length>512)return NextResponse.json({error:"Payload too large"},{status:400,headers});
    const body:unknown=JSON.parse(raw);
    const productId=body && typeof body==="object" && "productId" in body ? body.productId:null;
    return NextResponse.json(await setBuyerStoreFavorite({...scope,productId,enabled}),{headers});
  } catch(error){return fail(error);}
}
export const POST=(req:NextRequest,ctx:{params:Promise<{storeId:string}>})=>change(req,ctx,true);
export const DELETE=(req:NextRequest,ctx:{params:Promise<{storeId:string}>})=>change(req,ctx,false);
