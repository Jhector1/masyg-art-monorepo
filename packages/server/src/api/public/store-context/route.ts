import { NextRequest, NextResponse } from "next/server";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";
import { resolvePublicStoreFromHostHeader, isLocalPreviewHostHeader } from "@acme/core/lib/storefront-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"no-store"};

/** Public domain binding: the verified hostname, not user-supplied organization/store IDs, selects the store. */
export async function GET(req: NextRequest) {
  try {
    const store = await resolvePublicStoreFromHostHeader(req.headers.get("host"));
    return NextResponse.json({store:{id:store.id,slug:store.slug,name:store.name}},{headers});
  } catch(error) {
    if (error instanceof PublicCatalogError) {
      const localPreview = process.env.NODE_ENV === "development" && isLocalPreviewHostHeader(req.headers.get("host"));
      const detail = localPreview
        ? "Local storefront not configured or not published. Set the organization and store preview IDs in this storefront's .env.local."
        : "Storefront unavailable";
      return NextResponse.json({error:detail},{status:error.status,headers});
    }
    console.error("Published storefront domain resolution failed",error);
    return NextResponse.json({error:"Storefront unavailable"},{status:500,headers});
  }
}
