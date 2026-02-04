// File: src/app/api/private/cart/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Storefront } from "@prisma/client";
import { z } from "zod";

import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

import {
  getCart,
  isInCart,
  addToCart,
  patchCart,
  deleteFromCart,
} from "@acme/server/cart/cart.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ----------------------------- */
/* Helpers */
/* ----------------------------- */

function resolveSite(req: NextRequest): Storefront {
  const fromHeader = req.headers.get("x-storefront")?.toUpperCase();
  const fromQuery = req.nextUrl.searchParams.get("site")?.toUpperCase();
  const raw = (fromHeader || fromQuery) as Storefront | undefined;
  return raw === "JEANYVES" ? "JEANYVES" : "ZILEDIGITAL";
}

/** Never throw: returns null for empty body / invalid JSON */
async function readJsonSafe(req: NextRequest): Promise<unknown | null> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;

  try {
    const text = await req.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function noStoreJson(data: any, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireActorOr401(userId?: string, guestId?: string) {
  if (userId || guestId) return null;
  return noStoreJson({ error: "Unauthorized" }, { status: 401 });
}

/* ----------------------------- */
/* Zod Schemas (Zod v4-compatible) */
/* ----------------------------- */

const CartPostBodySchema = z.object({
  productId: z.string().min(1),
  digitalType: z.string().nullable().optional(),
  printType: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(99).default(1),

  format: z.string().min(1),
  size: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  frame: z.string().nullable().optional(),
  license: z.string().min(1),

  // optional design payload
  design: z.unknown().optional(),
  snapshot: z.boolean().optional(),
});

const CartPatchBodySchema = z.object({
  productId: z.string().min(1),
  digitalVariantId: z.string().min(1).optional(),
  printVariantId: z.string().min(1).optional(),

  // ✅ Zod v4: (keyType, valueType)
  updates: z.record(z.string(), z.unknown()),
});

const CartDeleteBodySchema = z.object({
  productId: z.string().min(1),
});

/* ----------------------------- */
/* Route Handlers */
/* ----------------------------- */

export async function GET(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  const sp = req.nextUrl.searchParams;

  // old "inCart" probe contract
  const productId = sp.get("productId");
  const digitalVariantId = sp.get("digitalVariantId");
  const printVariantId = sp.get("printVariantId");
  const originalVariantId = sp.get("originalVariantId");

  const live = sp.get("liveDesignPreview") === "1";

  if (productId && (digitalVariantId || printVariantId || originalVariantId)) {
    const out = await isInCart(
      site,
      { userId, guestId },
      { productId, digitalVariantId, printVariantId, originalVariantId }
    );
    return noStoreJson(out);
  }

  const products = await getCart(site, { userId, guestId }, { live });
  return noStoreJson(products);
}

export async function POST(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  // mutations require an actor
  const unauth = requireActorOr401(userId, guestId);
  if (unauth) return unauth;

  const body = await readJsonSafe(req);
  const parsed = CartPostBodySchema.safeParse(body);

  if (!parsed.success) {
    return noStoreJson(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const out = await addToCart(site, { userId, guestId }, parsed.data);
  return noStoreJson(out);
}

export async function PATCH(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  const unauth = requireActorOr401(userId, guestId);
  if (unauth) return unauth;

  const body = await readJsonSafe(req);
  const parsed = CartPatchBodySchema.safeParse(body);

  if (!parsed.success) {
    return noStoreJson(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // old semantics: service validates deeper
  const out = await patchCart(site, { userId, guestId }, parsed.data);
  return noStoreJson(out);
}

export async function DELETE(req: NextRequest) {
  const site = resolveSite(req);
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  const unauth = requireActorOr401(userId, guestId);
  if (unauth) return unauth;

  const body = await readJsonSafe(req);
  const parsed = CartDeleteBodySchema.safeParse(body);

  if (!parsed.success) {
    return noStoreJson(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const out = await deleteFromCart(site, { userId, guestId }, parsed.data.productId);
  return noStoreJson(out);
}
