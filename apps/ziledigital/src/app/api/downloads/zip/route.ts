// File: src/app/api/downloads/zip/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import archiver from "archiver";
import { Readable, PassThrough } from "stream";

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId   = searchParams.get("order");
  const sessionId = searchParams.get("session_id");

  if (!orderId && !sessionId) {
    return NextResponse.json({ error: "Provide order or session_id" }, { status: 400 });
  }

  // We include items->product so we can derive friendly filenames (title + ext)
  const order = await prisma.order.findFirst({
    where: orderId ? { id: orderId } : { stripeSessionId: sessionId! },
    include: {
      items: {
        include: { product: true }, // to get product title
      },
      downloadTokens: {
        include: { asset: true },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Build filename helpers
  const titleByProductId = new Map<string, string>();
  for (const it of order.items) {
    if (it.product?.id && it.product.title) {
      titleByProductId.set(it.product.id, it.product.title);
    }
  }
  const safe = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 80);

  // Node stream via PassThrough + archiver
  const pass = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", (err) => console.warn("zip warn:", err));
  archive.on("error", (err) => {
    console.error("zip error:", err);
    pass.destroy(err as any);
  });
  archive.pipe(pass);

  // Append each tokenized asset to the archive
  let idx = 1;
  for (const t of order.downloadTokens) {
    const a = t.asset;
    if (!a) continue;

    const url = t.signedUrl || a.url;
    if (!url) continue;

    // Choose a friendly filename; ensure uniqueness with an index
    const baseTitle = titleByProductId.get(a.productId) || "Artwork";
    const ext = a.ext || "bin";
    const filename = `${safe(baseTitle)}-${String(idx).padStart(2, "0")}.${safe(ext)}`;
    idx += 1;

    // Fetch and append streaming
    const res = await fetch(url);
    if (!res.ok || !res.body) continue;

    const nodeStream = Readable.fromWeb(res.body as any);
    archive.append(nodeStream, { name: filename });
  }

  // Finalize archive
  archive.finalize();

  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="order-${order.id}.zip"`,
    "Cache-Control": "no-store",
  });

  return new NextResponse(pass as any, { headers });
}
