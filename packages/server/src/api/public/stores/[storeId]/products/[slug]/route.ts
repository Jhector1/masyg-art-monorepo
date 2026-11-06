import { NextRequest, NextResponse } from "next/server";
import { getPublicProduct, PublicCatalogError } from "@acme/core/lib/public-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ storeId: string; slug: string }> }) {
  try {
    const { storeId, slug } = await context.params;
    const data = await getPublicProduct({ storeId, slug });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PublicCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Public catalog product failed", error);
    return NextResponse.json({ error: "Unable to load product" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
