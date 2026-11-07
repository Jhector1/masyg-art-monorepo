import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { resolvePublicStoreFromHostHeader } from "@acme/core/lib/storefront-host";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { TenantAccessError } from "@acme/core/lib/tenancy";
import { BuyerGrantError, authorizeBuyerGrant, consumeBuyerGrant } from "@acme/core/lib/buyer-grant-download";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { CartSafetyError } from "@acme/core/lib/cart-contract";
import { parsePrivateDigitalStorageKey, privateDigitalDownloadUrl, downloadFilename } from "@acme/server/lib/private-digital-download";
import { spoolPrivateDownload, PrivateDownloadSpoolError } from "@acme/server/lib/private-download-spool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0", "Vary":"Cookie", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff"};
const MAX_FILE_BYTES=40*1024*1024;
const jsonError=(status:number,message:string)=>Response.json({error:message},{status,headers});

/** Server-streamed purchase download: no caller-supplied URL, storage ID, or file ID. */
export async function POST(req:NextRequest, ctx:{params:Promise<{storeId:string;grantId:string}>}) {
  try {
    requireSameOriginJson(req);
    if (Number(req.headers.get("content-length") || "0") > 64) return jsonError(413,"Invalid download request");
    const session=await getServerSession(authOptions);
    const userId=session?.user && "id" in session.user && typeof session.user.id === "string" ? session.user.id : null;
    if (!userId) return jsonError(401,"Unauthorized");
    const {storeId,grantId}=await ctx.params;
    const verified=await resolvePublicStoreFromHostHeader(req.headers.get("host"));
    if (verified.id !== storeId) return jsonError(404,"Not found");
    const grant=await authorizeBuyerGrant({userId,storeId,grantId});
    const {extension}=parsePrivateDigitalStorageKey(grant.storageKey,grant.organizationId);
    const url=privateDigitalDownloadUrl(grant.storageKey,grant.organizationId);
    // Provider secrets stay server-side. Redirects are refused to prevent SSRF.
    const upstream=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(20000)});
    if (!upstream.ok || !upstream.body) {
      upstream.body?.cancel().catch(()=>{});
      return jsonError(502,"Private file is currently unavailable");
    }
    // Spool to a private bounded temporary file: do not allocate two complete
    // copies of the download in RAM, and do not expose bytes before the grant CAS.
    let spooled;
    try {
      spooled = await spoolPrivateDownload(upstream.body, upstream.headers.get("content-length"), MAX_FILE_BYTES);
    } catch (error) {
      if (error instanceof PrivateDownloadSpoolError) return jsonError(502, error.message);
      throw error;
    }
    try {
      // A revoked/refunded/exhausted grant cannot win a concurrent handoff race.
      await consumeBuyerGrant(grant);
    } catch (error) {
      await spooled.dispose();
      throw error;
    }
    return new Response(spooled.body,{status:200,headers:{
      ...headers,"Content-Type":grant.mimeType || "application/octet-stream",
      "Content-Length":String(spooled.byteLength),
      "Content-Disposition":`attachment; filename="${downloadFilename(grant.label,extension)}"`,
    }});
  } catch(error) {
    if (error instanceof CartSafetyError) return jsonError(400,"Invalid request origin or type");
    if (error instanceof BuyerGrantError || error instanceof TenantAccessError || error instanceof PublicCatalogError)
      return jsonError(error.status,error.message);
    console.error("Private digital grant delivery failed",error instanceof Error ? error.name : "unknown");
    return jsonError(503,"Private download unavailable");
  }
}
