// File: src/app/api/user/favorite/route.ts
import { NextRequest, NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import type { Storefront } from "@prisma/client";
import { productListSelect } from "@acme/core/types";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

function resolveSite(req: NextRequest): Storefront {
  const fromHeader = req.headers.get("x-storefront")?.toUpperCase();
  const fromQuery = req.nextUrl.searchParams.get("site")?.toUpperCase();
  const raw = (fromHeader || fromQuery) as Storefront | undefined;
  return raw === "JEANYVES" ? "JEANYVES" : "ZILEDIGITAL";
}


// async function requireUserId(req: NextRequest): Promise<string | NextResponse> {
//   const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
//   const userId = token?.sub ? String(token.sub) : undefined;
//   if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//   return userId;
// }

// GET /api/favorite
// File: src/app/api/favorite/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { prisma, productListSelect } from "@/types";
// import { requireUserId } from "@/utils/auth"; // ✅ adjust if in different utils

export async function GET(req: NextRequest) {
  const site = resolveSite(req);
  const { userId } = await getCustomerIdFromRequest(req);
  if(!userId)
      return NextResponse.json({ error: "Missing UserId" }, { status: 400 });
  // const uidOrResp = await requireUserId(req);
  // if (uidOrResp instanceof NextResponse) return uidOrResp;
  // const userId = uidOrResp;

  // fetch favorites + product + user-specific design
  const favorites = await prisma.favorite.findMany({
    where: { userId, site },
    select: {
      product: {
        select: {
          ...productListSelect,
          _count: { select: { orderItems: true } },
          designs: {
            select: { previewUrl: true },
            where: { userId },
            take: 1,
          },
        },
      },
    },
  });

  const products = favorites.map((f) => f.product);

  const payload = products.map((p) => {
    let isUserDesignApplied = false;
    const thumbnails = [...p.thumbnails];

    if (p.designs.length > 0 && p.designs[0].previewUrl) {
      isUserDesignApplied = true;
      thumbnails[0] = p.designs[0].previewUrl!;
    }

    return {
      ...p,
      thumbnails,
      purchaseCount: p._count.orderItems,
      isUserDesignApplied,
    };
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

// POST /api/favorite  Body: { productId: string }
export async function POST(req: NextRequest) {
  const site = resolveSite(req);
  // const uidOrResp = await requireUserId(req);
  // if (uidOrResp instanceof NextResponse) return uidOrResp;
  // const userId = uidOrResp;
  const { userId } = await getCustomerIdFromRequest(req);
  if(!userId)
      return NextResponse.json({ error: "Missing UserId" }, { status: 400 });
  const { productId } = await req.json();
  if (!productId)
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await prisma.favorite.upsert({
    where: { userId_productId_site: { userId, productId: String(productId), site } },
    create: { userId, productId: String(productId), site },
    update: {},
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

// DELETE /api/favorite  Body: { productId: string }
export async function DELETE(req: NextRequest) {
  const site = resolveSite(req);
  // const uidOrResp = await requireUserId(req);
  // if (uidOrResp instanceof NextResponse) return uidOrResp;
  // const userId = uidOrResp;
  const { userId } = await getCustomerIdFromRequest(req);
  if(!userId)
      return NextResponse.json({ error: "Missing UserId" }, { status: 400 });


  const { productId } = await req.json();
  if (!productId)
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await prisma.favorite
    .delete({
      where: { userId_productId_site: { userId, productId: String(productId), site } },
    })
    .catch(() => {
      /* idempotent */
    });

  return NextResponse.json({ ok: true }, { status: 200 });
}
