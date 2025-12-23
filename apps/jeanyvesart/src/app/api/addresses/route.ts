// File: src/app/api/addresses/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
// import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { getPrincipalFromRequest } from "@acme/auth";
import { authOptions } from "@/lib/auth";
function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function GET(req: NextRequest) {
const { userId } = await getPrincipalFromRequest(req, authOptions);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noCache() });

  const addresses = await prisma.address.findMany({
    where: { userId: String(userId) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      street: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ addresses }, { status: 200, headers: noCache() });
}

export async function POST(req: NextRequest) {
const { userId } = await getPrincipalFromRequest(req, authOptions);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noCache() });

  const body = await req.json().catch(() => ({}));

  const street = String(body?.street ?? "").trim();
  const city = String(body?.city ?? "").trim();
  const state = String(body?.state ?? "").trim();
  const postalCode = String(body?.postalCode ?? "").trim();
  const country = String(body?.country ?? "").trim();

  if (!street || !city || !state || !postalCode || !country) {
    return NextResponse.json({ error: "Missing required address fields" }, { status: 400, headers: noCache() });
  }

  const created = await prisma.address.create({
    data: {
      userId: String(userId),
      label: body?.label ? String(body.label).trim() : null,
      street,
      city,
      state,
      postalCode,
      country,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 200, headers: noCache() });
}
