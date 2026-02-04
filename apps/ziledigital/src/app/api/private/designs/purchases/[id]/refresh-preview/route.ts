// app/api/purchases/[id]/refresh-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
// import cloudinary from "@/lib/cloudinary"; // if you have a client

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const { id } = await params;

  // enforce ownership
  const pd = await prisma.purchasedDesign.findUnique({
    where: { id },
    select: { id: true, userId: true, guestId: true, previewUrl: true },
  });
  if (!pd) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((userId && pd.userId !== userId) || (guestId && pd.guestId !== guestId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // If you generate previews on purchase, you can either:
  //  - re-upload a fresh preview image to Cloudinary, or
  //  - simply bust cache by appending a version param.
  // For now we just append a cache-buster (works if it's already on Cloudinary/CDN).
  const fresh = pd.previewUrl
    ? `${pd.previewUrl}${
        pd.previewUrl.includes("?") ? "&" : "?"
      }v=${Date.now()}`
    : null;

  await prisma.purchasedDesign.update({
    where: { id },
    data: { previewUrl: fresh ?? pd.previewUrl },
  });

  return NextResponse.json({ previewUrl: fresh ?? pd.previewUrl });
}
