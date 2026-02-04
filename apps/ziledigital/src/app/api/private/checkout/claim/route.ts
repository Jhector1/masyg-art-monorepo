export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { requireUser } from "@acme/core/utils/requireUser";
// import { requireUser } from "@/utils/requireUser"; // your helper that throws 401

const db = new PrismaClient();
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const user = await requireUser(); // must be logged in
    const { claimToken } = await req.json();
    if (!claimToken) return NextResponse.json({ error: "claimToken required" }, { status: 400 });

    const tokenHash = hash(claimToken);
    const now = new Date();

    const order = await db.order.findFirst({
      where: {
        claimTokenHash: tokenHash,
        claimTokenExpiresAt: { gt: now },
        userId: null,
      },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // attach order to user and scrub the token
    await db.$transaction([
      db.order.update({
        where: { id: order.id },
        data: {
          userId: user.id,
          guestId: null,
          claimTokenHash: null,
          claimTokenExpiresAt: null,
        },
      }),
      // re-tag all the order's download tokens to the user (so future links are user-scoped)
      db.downloadToken.updateMany({
        where: { orderId: order.id },
        data: { userId: user.id, guestId: null },
      }),
    ]);

    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: "Could not claim order" }, { status });
  }
}
