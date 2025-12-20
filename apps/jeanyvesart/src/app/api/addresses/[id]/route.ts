// File: src/app/api/addresses/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const id = String(params.id || "");

  const { userId } = await getCustomerIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noCache() });

  // enforce ownership
  const found = await prisma.address.findFirst({
    where: { id, userId: String(userId) },
    select: { id: true },
  });

  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noCache() });

  await prisma.address.delete({ where: { id } });
  return NextResponse.json({ ok: true }, { status: 200, headers: noCache() });
}
