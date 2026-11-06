import { NextRequest, NextResponse } from "next/server";
import { listPublicProducts, PublicCatalogError } from "@acme/core/lib/public-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await context.params;
    const params = req.nextUrl.searchParams;
    const limit = params.has("limit") ? Number(params.get("limit")) : undefined;
    const page = params.has("page") ? Number(params.get("page")) : undefined;
    const data = await listPublicProducts({ storeId, query: params.get("q") ?? undefined, limit, page });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PublicCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Public catalog list failed", error);
    return NextResponse.json({ error: "Unable to list products" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
