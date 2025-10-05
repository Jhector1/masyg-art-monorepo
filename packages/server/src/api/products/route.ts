// File: src/app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, productListSelect } from "@acme/core/types";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

export const runtime = "nodejs";


function parseTypes(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const digitalOnly = sp.get("digitalOnly");
  const typeParam = sp.get("type");

  // Legacy flag (explicit override)
  if (digitalOnly === "true") return ["DIGITAL"];
  if (digitalOnly === "false") return []; // all

  // DEFAULT: digital + print
  if (!typeParam || typeParam.trim() === "") {
    return ["DIGITAL", "PRINT"];
  }

  // Parse ?type=...
  const raw = typeParam.split(",").map((s) => s.trim().toUpperCase());
  if (raw.includes("ALL") || raw.includes("*")) return [];

  const allowed = new Set(["DIGITAL", "PRINT", "ORIGINAL"]);
  const types = raw.filter((t) => allowed.has(t));
  // If nothing valid, fall back to default (digital + print)
  return types.length ? types : ["DIGITAL", "PRINT"];
}

export async function GET(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const orConditions: any[] = [];
  if (userId) orConditions.push({ userId });
  if (guestId) orConditions.push({ guestId });

  const types = parseTypes(req); // [] => all; otherwise subset
  const whereClause =
    types.length === 0
      ? {}
      : { variants: { some: { type: { in: types as any } } } };

  const products = await prisma.product.findMany({
    where: whereClause,
    select: {
      ...productListSelect,
      _count: { select: { orderItems: true } },
      designs: {
        select: { previewUrl: true, userId: true, guestId: true },
        where: { OR: orConditions.length ? orConditions : undefined },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const payload = products.map((p) => {
    let isUserDesignApplied = false;
    const thumbnails = [...p.thumbnails];
    if (p.designs.length > 0 && p.designs[0].previewUrl) {
      isUserDesignApplied = true;
      thumbnails[0] = p.designs[0].previewUrl!;
    }
    return { ...p, thumbnails, purchaseCount: p._count.orderItems, isUserDesignApplied };
  });

  return NextResponse.json(payload);
}
