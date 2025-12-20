import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import {
  listFavoritesForUser,
  addFavorite,
  removeFavorite,
} from "@acme/server/services/favorites";
import type { Storefront } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveSite(req: NextRequest): Storefront {
  const fromHeader = req.headers.get("x-storefront")?.toUpperCase();
  const fromQuery = req.nextUrl.searchParams.get("site")?.toUpperCase();
  const raw = (fromHeader || fromQuery) as Storefront | undefined;
  return raw === "JEANYVES" ? "JEANYVES" : "ZILEDIGITAL";
}
// Optional: block liking originals that are RESERVED/SOLD
async function assertOriginalLikeAllowed(site: Storefront, productId: string) {
  const ov = await prisma.productVariant.findFirst({
    where: { productId, type: "ORIGINAL" },
    select: { status: true },
  });
  if (ov?.status === "RESERVED" || ov?.status === "SOLD") {
    throw new Error("Original is unavailable.");
  }
}
export async function GET(req: NextRequest) {
  const site = "JEANYVES"// resolveSite(req);
  const { userId } = await getCustomerIdFromRequest(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const types = req.nextUrl.searchParams.get("types") ?? undefined;

  const payload = await listFavoritesForUser({ userId: String(userId), site, types });
  return NextResponse.json(payload, { status: 200, headers: noCache() });
}

export async function POST(req: NextRequest) {
  const site = "JEANYVES"// resolveSite(req);
const { userId } = await getCustomerIdFromRequest(req);

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  try {
    await assertOriginalLikeAllowed(site, String(productId)); // ✅ optional
    await addFavorite({ userId: String(userId), productId: String(productId), site });
    return NextResponse.json({ ok: true }, { status: 200, headers: noCache() });
  } catch (e: any) {
    return NextResponse.json(
      { error: "unavailable", message: e?.message ?? "Unavailable" },
      { status: 409, headers: noCache() }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const site = "JEANYVES"// resolveSite(req);
  const { userId } = await getCustomerIdFromRequest(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let productId: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    productId = body?.productId ?? null;
  } catch {}
  if (!productId) productId = new URL(req.url).searchParams.get("productId");

  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await removeFavorite({ userId: String(userId), productId: String(productId), site });
  return NextResponse.json({ ok: true }, { status: 200, headers: noCache() });
}

function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}
