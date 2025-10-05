// file: src/app/api/designs/[id]/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { prisma } from "@acme/core/lib/prisma"; // your singleton client

export const runtime = "nodejs";

// Optional: if you don't already configure globally
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//   api_key: process.env.CLOUDINARY_API_KEY!,
//   api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

type Body = {
  dataUrl: string; // data:image/...;base64,....
  width?: number; // default 800, max 2000
  quality?: number; // default 70,  1..100
  overwritePreview?: boolean; // default true
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ designId: string }> }
) {
  // you must await params before using it
  const { designId } = await params;
  if (!designId)
    return NextResponse.json({ error: "Missing design id" }, { status: 400 });

  try {
    // 1) Parse & validate input
    const {
      dataUrl,
      width = 800,
      quality = 70,
      overwritePreview = true,
    } = (await req.json()) as Body;

    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Expected dataUrl (data:image/...)" },
        { status: 400 }
      );
    }

    const safeWidth = Math.max(64, Math.min(2000, Number(width) || 800));
    const safeQuality = Math.max(1, Math.min(100, Number(quality) || 70));

    // 2) Authorize: make sure the requester owns this design (or is the guest that created it)
    const design = await prisma.userDesign.findUnique({
      where: { id: designId },
      select: { id: true, userId: true, guestId: true, productId: true },
    });
    if (!design)
      return NextResponse.json({ error: "Design not found" }, { status: 404 });

    // TODO: replace this with your auth logic:
    // const session = await getAuth(req); // however you auth
    // const isOwner = (session?.user?.id && session.user.id === design.userId) || (getGuestId(req) === design.guestId);
    // if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 3) Decode & encode to WEBP (small, fast, consistent)
    const base64 = dataUrl.split(",")[1];
    if (!base64)
      return NextResponse.json({ error: "Malformed dataUrl" }, { status: 400 });

    const input = Buffer.from(base64, "base64");

    const webp = await sharp(input)
      .resize({
        width: safeWidth,
        withoutEnlargement: true,
        fit: "inside",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .webp({ quality: safeQuality })
      .toBuffer();

    // 4) Upload to Cloudinary with deterministic public_id so subsequent updates overwrite
    //    Using a stable id avoids piling up files and lets you invalidate cache.
    const publicId = `products/designs/previews/design_${designId}`;
    const upload = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          type: "upload",
          overwrite: overwritePreview,
          format: "webp",
          invalidate: true,
          transformation: [
            { quality: "auto", fetch_format: "auto" },
            {
              overlay: { public_id: "watermark" },
              width: "1.0",
              height: "1.0",
              crop: "fill",
              gravity: "center",
              opacity: 10,
              flags: ["relative"],
            },
          ],

          // make sure clients don’t see a cached old preview
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(webp);
    });

    const previewUrl = upload.secure_url as string;

    // 5) Persist preview metadata on the design (or also on CartItem if you want a frozen copy per line)
    await prisma.userDesign.update({
      where: { id: designId },
      data: {
        previewPublicId: upload.public_id,
        previewUrl,
        previewUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      previewUrl,
      publicId: upload.public_id,
    });
  } catch (err: any) {
    console.error("[design preview upload] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
