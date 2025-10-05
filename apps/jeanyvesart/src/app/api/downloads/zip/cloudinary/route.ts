// File: src/app/api/downloads/zip/cloudinary/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";
const prisma = new PrismaClient();

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:     process.env.CLOUDINARY_API_KEY!,
  api_secret:  process.env.CLOUDINARY_API_SECRET!,
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId   = searchParams.get("order");
  const sessionId = searchParams.get("session_id");

  if (!orderId && !sessionId) {
    return NextResponse.json({ error: "Provide order or session_id" }, { status: 400 });
  }

  // Load tokens & assets for that order
  const order = await prisma.order.findFirst({
    where: orderId ? { id: orderId } : { stripeSessionId: sessionId! },
    include: {
      downloadTokens: { include: { asset: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Group Cloudinary public_ids by resource_type
  const images = new Set<string>();
  const raws   = new Set<string>();

  for (const t of order.downloadTokens) {
    const a = t.asset;
    if (!a?.storageKey) continue; // need Cloudinary public_id saved

    // Decide resource type
    const rt =
      a.mimeType?.startsWith("image/") ? "image" :
      a.mimeType === "application/pdf" || a.isVector || a.ext === "pdf" || a.ext === "svg"
        ? "raw"
        : "image"; // default to image

    if (rt === "image") images.add(a.storageKey);
    else raws.add(a.storageKey);
  }

  const hasImages = images.size > 0;
  const hasRaws   = raws.size > 0;

  if (!hasImages && !hasRaws) {
    // No Cloudinary-backed files — fall back to local archiver
    return NextResponse.redirect(`/api/downloads/zip?${orderId ? `order=${orderId}` : `session_id=${sessionId}`}`, { status: 302 });
  }

  try {
    // If just one resource type, do a single Cloudinary ZIP
    if (hasImages && !hasRaws) {
      const zipUrl = cloudinary.utils.download_zip_url({
        public_ids: Array.from(images),
        resource_type: "image",
        use_original_filename: true,
      });
      return NextResponse.redirect(zipUrl, { status: 302 });
    }
    if (hasRaws && !hasImages) {
      const zipUrl = cloudinary.utils.download_zip_url({
        public_ids: Array.from(raws),
        resource_type: "raw",
        use_original_filename: true,
      });
      return NextResponse.redirect(zipUrl, { status: 302 });
    }
  } catch (err) {
    // If Cloudinary ZIP building fails for any reason, fall back
    console.error("Cloudinary ZIP error:", err);
  }

  // Mixed resource types → fall back to local archiver (single unified zip)
  return NextResponse.redirect(`/api/downloads/zip?${orderId ? `order=${orderId}` : `session_id=${sessionId}`}`, { status: 302 });
}
