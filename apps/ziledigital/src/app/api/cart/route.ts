import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import type { Storefront } from "@prisma/client";

// IMPORTANT: these service functions must keep the OLD contracts
import {
  getCart,
  isInCart,
  addToCart,
  patchCart,      // must match old PATCH semantics (variants), not quantity-only
  deleteFromCart,
} from "@acme/server/cart/cart.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveSite(req: NextRequest): Storefront {
  const fromHeader = req.headers.get("x-storefront")?.toUpperCase();
  const fromQuery = req.nextUrl.searchParams.get("site")?.toUpperCase();
  const raw = (fromHeader || fromQuery) as Storefront | undefined;
  return raw === "JEANYVES" ? "JEANYVES" : "ZILEDIGITAL";
}

export async function GET(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  const sp = req.nextUrl.searchParams;
  const productId = sp.get("productId");
  const digitalVariantId = sp.get("digitalVariantId");
  const printVariantId = sp.get("printVariantId");
  const originalVariantId = sp.get("originalVariantId");
  const live = sp.get("liveDesignPreview") === "1";

  // ✅ keep the old "inCart" probe contract
  if (productId && (digitalVariantId || printVariantId || originalVariantId)) {
    const out = await isInCart(site, { userId, guestId }, {
      productId,
      digitalVariantId,
      printVariantId,
      originalVariantId,
    });
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  }

  const products = await getCart(site, { userId, guestId }, { live });
  return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const body = await req.json();

  // ✅ must return { message, result } like before
  const out = await addToCart(site, { userId, guestId }, body);
  return NextResponse.json(out);
}

export async function PATCH(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const body = await req.json();

  // ✅ must accept { productId, digitalVariantId, printVariantId, updates }
  // ✅ must return { message, digitalVariantId, printVariantId, price, originalPrice }
  const out = await patchCart(site, { userId, guestId }, body);
  return NextResponse.json(out);
}

export async function DELETE(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const { productId } = await req.json();

  const out = await deleteFromCart(site, { userId, guestId }, productId);
  // ✅ must return { message } like before
  return NextResponse.json(out);
}
