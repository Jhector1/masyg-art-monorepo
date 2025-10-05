export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { stripeSessionId: sessionId },
      select: { id: true, userId: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.userId) return NextResponse.json({ alreadyClaimed: true });

    // generate a 32-byte random token; store only the hash
    let raw = "";
    let tokenHash = "";
    let tries = 0;
    while (true) {
      raw = crypto.randomBytes(32).toString("hex");
      tokenHash = hash(raw);
      try {
        const expires = new Date(Date.now() + 24 * 3600 * 1000); // 24h
        await db.order.update({
          where: { id: order.id },
          data: { claimTokenHash: tokenHash, claimTokenExpiresAt: expires },
        });
        return NextResponse.json({ claimToken: raw, expiresAt: expires.toISOString() });
      } catch (e: any) {
        // very rare: hash collision on unique; retry a couple times
        if (++tries > 2) throw e;
      }
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to prepare claim" }, { status: 500 });
  }
}
