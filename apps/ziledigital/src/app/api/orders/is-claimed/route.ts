// src/app/api/orders/is-claimed/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ claimed: false }, { status: 400 });
  const order = await db.order.findUnique({
    where: { stripeSessionId: sessionId },
    select: { userId: true },
  });
  return NextResponse.json({ claimed: !!order?.userId });
}
