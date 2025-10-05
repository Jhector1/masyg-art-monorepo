// File: src/app/api/dashboard/route.ts
import {  NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@acme/core/lib/auth";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const [
    favoriteCount,
    downloadCount,
    purchasedArtworks,
    ordersPlaced,
    avgOrderValue,
  ] = await prisma.$transaction(async (tx) => {
    const favoriteCount = await tx.favorite.count({ where: { userId } });
    const downloadCount =
      (
        await tx.user.findUnique({
          where: { id: userId },
          select: { downloadCount: true },
        })
      )?.downloadCount ?? 0;

    const purchasedArtworks = await tx.orderItem.count({
      where: { order: { userId } },
    });

    const ordersPlaced = await tx.order.count({
      where: { userId },
    });

    const { _avg } = await tx.order.aggregate({
      where: { userId },
      _avg: { total: true },
    });
    const avgOrderValue = _avg.total ?? 0;

    return [
      favoriteCount,
      downloadCount,
      purchasedArtworks,
      ordersPlaced,
      avgOrderValue,
    ] as const;
  });

  return NextResponse.json({
    favoriteCount,
    downloadCount,
    purchasedArtworks,
    ordersPlaced,
    avgOrderValue,
  });
}
