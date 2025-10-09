import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@acme/core/lib/auth";
// import {auth} from '@/lib/auth'

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin(req);

  const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;

  const where: Prisma.ProductWhereInput | undefined = q
    ? {
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { category: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
        ],
      }
    : undefined;

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { category: true, assets: true },
    take: 50,
  });

  return NextResponse.json(products);
}
