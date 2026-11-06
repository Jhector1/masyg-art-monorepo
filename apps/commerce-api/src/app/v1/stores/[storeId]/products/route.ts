import type { NextRequest } from "next/server";
import { GET as canonicalGet } from "@acme/server/api/public/stores/[storeId]/products/route";
import {
  addPublishedCatalogCors,
  publishedCatalogOptions,
} from "@acme/server/lib/public-catalog-cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Thin HTTP adapter: canonical published-catalog handler owns validation and tenancy. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> },
): Promise<Response> {
  const response = await canonicalGet(request, context);
  return addPublishedCatalogCors(response);
}

export function OPTIONS(): Response {
  return publishedCatalogOptions();
}
