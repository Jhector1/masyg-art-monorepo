// File: src/app/api/downloads/archive/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { zipAllAssets, type ZipAsset } from "@acme/core/lib/zipAllAssets";

const db = new PrismaClient();

/**
 * GET /api/downloads/archive?order=<id> or ?session_id=<stripe_session_id>
 * Also supports POST with { assets: ZipAsset[] } if you want to pass assets directly.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId   = searchParams.get("order");
  const sessionId = searchParams.get("session_id");

  if (!orderId && !sessionId) {
    return NextResponse.json({ error: "Provide order or session_id" }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: orderId ? { id: orderId } : { stripeSessionId: sessionId! },
    include: { downloadTokens: { include: { asset: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const assets: ZipAsset[] = order.downloadTokens
    .map(t => t.asset)
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map(a => ({
      storageKey: a.storageKey ?? undefined,          // Cloudinary public_id (no extension)
      url: a.url,                                     // fallback parser uses this if needed
      resourceType: a.resourceType as any,            // "image" | "raw" | "video"
      deliveryType: a.deliveryType as any,            // "upload" | "authenticated" | "private"
    }));

  if (!assets.length) return NextResponse.json({ error: "No assets for order" }, { status: 404 });

  const zipUrl = await zipAllAssets(assets);          // uses fully_qualified_public_ids under the hood
  return NextResponse.redirect(zipUrl, { status: 302 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body?.assets)) {
    return NextResponse.json({ error: "Provide { assets: ZipAsset[] }" }, { status: 400 });
  }
  const zipUrl = await zipAllAssets(body.assets as ZipAsset[]);
  return NextResponse.json({ url: zipUrl });
}
