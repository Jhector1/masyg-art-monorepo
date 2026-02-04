// File: src/app/api/private/downloads/archive/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { zipAllAssets, type ZipAsset } from "@acme/core/lib/zipAllAssets";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

const db = new PrismaClient();

function buildOwnerWhere(actor: { userId?: string; guestId?: string }) {
  if (actor.userId) return { userId: actor.userId };
  if (actor.guestId) return { guestId: actor.guestId };
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order");
  const sessionId = searchParams.get("session_id");

  if (!orderId && !sessionId) {
    return NextResponse.json({ error: "Provide order or session_id" }, { status: 400 });
  }

  const actor = await getCustomerIdFromRequest(req);
  const ownerWhere = buildOwnerWhere(actor);
  if (!ownerWhere) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ IMPORTANT: constrain by owner *and* by identifier
  const order = await db.order.findFirst({
    where: {
      ...ownerWhere,
      ...(orderId ? { id: orderId } : { stripeSessionId: sessionId! }),
    },
    include: {
      downloadTokens: {
        include: { asset: true },
      },
    },
  });

  // Avoid leaking whether an order exists
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ✅ OPTIONAL HARDENING (recommended):
  // Filter tokens that are expired or exhausted if you track that.
  const now = new Date();
  const usableTokens = order.downloadTokens.filter((t: any) => {
    if (t.expiresAt && new Date(t.expiresAt).getTime() < now.getTime()) return false;
    if (typeof t.remainingUses === "number" && t.remainingUses <= 0) return false;
    return true;
  });

  const assets: ZipAsset[] = usableTokens
    .map((t) => t.asset)
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({
      storageKey: a.storageKey ?? undefined,
      url: a.url,
      resourceType: a.resourceType as any,
      deliveryType: a.deliveryType as any,
    }));

  if (!assets.length) {
    return NextResponse.json({ error: "No assets for order" }, { status: 404 });
  }

  const zipUrl = await zipAllAssets(assets);

  // ✅ If you want to keep your existing client flow, redirect is fine.
  // (Your client should use credentials: "omit" for external urls.)
  return NextResponse.redirect(zipUrl, { status: 302 });
}
