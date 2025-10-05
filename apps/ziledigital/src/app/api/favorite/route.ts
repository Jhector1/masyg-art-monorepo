import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { listFavoritesForUser, addFavorite, removeFavorite } from "@acme/server/services/favorites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/favorite?types=ORIGINAL | ALL | DIGITAL,PRINT
export async function GET(req: NextRequest) {
  const { userId } = await getCustomerIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Missing UserId" }, { status: 400 });

  // const sp = req.nextUrl.searchParams;
  // const typesParam = sp.get("types"); // e.g. "ORIGINAL" or "DIGITAL,PRINT" or "ALL"
  // const types =
  //   !typesParam || typesParam === "ALL"
  //     ? undefined
  //     : typesParam.split(",").map(s => s.trim().toUpperCase());

  const payload = await listFavoritesForUser({ userId }); // <-- FIXED: provide `types` key
  return NextResponse.json(payload, { status: 200, headers: noCache() });
}

// POST /api/favorite  { productId }
export async function POST(req: NextRequest) {
  const { userId } = await getCustomerIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Missing UserId" }, { status: 400 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await addFavorite(userId, String(productId));
  return NextResponse.json({ ok: true }, { status: 200 });
}

// DELETE /api/favorite  { productId } or ?productId=...
export async function DELETE(req: NextRequest) {
  const { userId } = await getCustomerIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Missing UserId" }, { status: 400 });

  let productId: string | null = null;
  // try body
  try {
    const body = await req.json().catch(() => null);
    productId = body?.productId ?? null;
  } catch {/* ignore */}
  // fallback to query
  if (!productId) productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await removeFavorite(userId, String(productId));
  return NextResponse.json({ ok: true }, { status: 200 });
}

function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  };
}
