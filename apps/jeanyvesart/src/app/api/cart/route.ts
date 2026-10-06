import { NextRequest, NextResponse } from "next/server";
// import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import type { Storefront } from "@prisma/client";
import { getOrCreateGuestId, getPrincipalFromRequest } from "@acme/auth";
import { prisma } from "@acme/core/lib/prisma";

import {
  getCart,
  isInCart,
  addToCart,
  patchCart,
  deleteFromCart,
  isCartOwnerMissingError,
} from "@acme/server/cart/cart.service";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;


async function requireCustomer(req: NextRequest) {
let { userId, guestId } = await getPrincipalFromRequest(req, authOptions);

  // Always ensure some identity exists for cart operations
  if (!userId && !guestId) {
    guestId = await getOrCreateGuestId();
  }

  return { userId, guestId: guestId! };
}

function cartOwnerWhere(site: Storefront, userId?: string | null, guestId?: string | null) {
  return userId
    ? { cart: { userId, site } }
    : { cart: { guestId: guestId!, site } };
}

function staleSessionResponse(error: unknown) {
  if (!isCartOwnerMissingError(error)) return null;
  return NextResponse.json(
    {
      error: "session_user_missing",
      message: "Your session no longer matches an account. Please sign in again.",
    },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const site: Storefront = "JEANYVES"; // resolveSite(req);
  const { userId, guestId } = await requireCustomer(req);

  const sp = req.nextUrl.searchParams;
  const productId = sp.get("productId");
  const digitalVariantId = sp.get("digitalVariantId");
  const printVariantId = sp.get("printVariantId");
  const originalVariantId = sp.get("originalVariantId");
  const live = sp.get("liveDesignPreview") === "1";

  // old inCart probe contract
  if (productId && (digitalVariantId || printVariantId || originalVariantId)) {
    const out = await isInCart(
      site,
      { userId, guestId },
      { productId, digitalVariantId, printVariantId, originalVariantId }
    );
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  }

  const products = await getCart(site, { userId, guestId }, { live });
  return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const site: Storefront = "JEANYVES"; // resolveSite(req);
  const { userId, guestId } = await requireCustomer(req);

  const body = await req.json();
  try {
    const out = await addToCart(site, { userId, guestId }, body);
    return NextResponse.json(out);
  } catch (error) {
    const stale = staleSessionResponse(error);
    if (stale) return stale;
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const site: Storefront = "JEANYVES"; // resolveSite(req);
  const { userId, guestId } = await requireCustomer(req);

  const body = await req.json();
  const out = await patchCart(site, { userId, guestId }, body);
  return NextResponse.json(out);
}

export async function DELETE(req: NextRequest) {
  const site: Storefront = "JEANYVES"; // resolveSite(req);
  const { userId, guestId } = await requireCustomer(req);

  const body = await req.json().catch(() => ({}));
  const cartItemId = body?.cartItemId ? String(body.cartItemId) : null;
  const productId = body?.productId ? String(body.productId) : null;

  // ✅ NEW: support deleting by cartItemId (matches your UI)
  if (cartItemId) {
    const where = {
      id: cartItemId,
      ...cartOwnerWhere(site, userId, guestId),
    };

    const del = await prisma.cartItem.deleteMany({ where });

    return NextResponse.json({
      message: del.count ? "Removed" : "Item not found",
    });
  }

  // ✅ OLD: keep legacy contract { productId }
  if (productId) {
    const out = await deleteFromCart(site, { userId, guestId }, productId);
    return NextResponse.json(out);
  }

  return NextResponse.json(
    { message: "Missing cartItemId or productId" },
    { status: 400 }
  );
}
