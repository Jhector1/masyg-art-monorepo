import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@acme/core/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The admin app owns admin authentication. The shared @acme/core
// requireAdmin() intentionally rejects all storefront-origin requests.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
  const where: Prisma.ProductWhereInput | undefined = q
    ? {
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
          {
            category: {
              is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            },
          },
        ],
      }
    : undefined;

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { category: true, assets: true },
    take: 50,
  });

  return NextResponse.json(products, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
