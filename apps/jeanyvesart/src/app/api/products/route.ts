import { NextRequest, NextResponse } from "next/server";
import { listProductsCore } from "@acme/server/services/products";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

export async function GET(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const t = req.nextUrl.searchParams.get("type");
  const types =
    !t || !t.trim()
      ? undefined // default NON_ORIGINAL inside core
      : (t.toUpperCase() === "ALL" || t === "*") ? "ALL" :
        t.split(",").map(s => s.trim().toUpperCase()) as any;

  const data = await listProductsCore({ types, userId, guestId });
  return NextResponse.json(data);
}