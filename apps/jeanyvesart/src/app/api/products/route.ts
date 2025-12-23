import { NextRequest, NextResponse } from "next/server";
import { listProductsCore } from "@acme/server/services/products";
import { getPrincipalFromRequest } from "@acme/auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
 const { userId, guestId } = await getPrincipalFromRequest(req, authOptions);
  const t = req.nextUrl.searchParams.get("type");
  const types =
    !t || !t.trim()
      ? undefined // default NON_ORIGINAL inside core
      : (t.toUpperCase() === "ALL" || t === "*") ? "ALL" :
        t.split(",").map(s => s.trim().toUpperCase()) as any;
      
 const site = "JEANYVES";
  const data = await listProductsCore({ site,types, userId, guestId });
  return NextResponse.json(data);
}