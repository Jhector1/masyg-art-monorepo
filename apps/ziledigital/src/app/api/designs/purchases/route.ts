// app/api/purchases/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest"; // your helper

export const runtime = "nodejs";

const PAGE_SIZE_DEFAULT = 24;

export async function GET(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  if (!userId && !guestId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") || undefined;
  const take = Math.min(
    Math.max(Number(searchParams.get("take") || PAGE_SIZE_DEFAULT), 1),
    60
  );

  const where = userId ? { userId } : { guestId: guestId! };

  // fetch +1 to know if there’s another page
  const rows = await prisma.purchasedDesign.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      orderId: true,
      productId: true,
      previewUrl: true,
      createdAt: true,
      product: { select: { title: true } },
    },
  });

  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, -1) : rows).map((r) => ({
    id: r.id,
    orderId: r.orderId,
    productId: r.productId,
    productTitle: r.product?.title ?? null,
    previewUrl: r.previewUrl ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
  });
}
