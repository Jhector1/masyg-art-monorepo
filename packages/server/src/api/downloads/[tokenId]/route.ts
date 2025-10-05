// File: src/app/api/downloads/[tokenId]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function GET(
  _req: Request,
  {   params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
    const { tokenId } = await params;

//   const tokenId = params.tokenId;
  if (!tokenId) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const token = await prisma.downloadToken.findUnique({
    where: { id: tokenId },
    include: { asset: true, order: true, user: true },
  });

  if (!token) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

  const now = new Date();
  if (token.expiresAt && token.expiresAt < now)
    return NextResponse.json({ error: "Link expired" }, { status: 410 });

  if (token.remainingUses !== null && token.remainingUses !== undefined && token.remainingUses <= 0)
    return NextResponse.json({ error: "No remaining uses" }, { status: 410 });

  // Pick URL to redirect to (prefer signedUrl if present)
  const redirectUrl = token.signedUrl || token.asset.url;
  if (!redirectUrl) return NextResponse.json({ error: "Asset unavailable" }, { status: 404 });

  // Update counters (best-effort)
  await prisma.downloadToken.update({
    where: { id: token.id },
    data: {
      downloadCount: { increment: 1 },
      remainingUses:
        token.remainingUses !== null && token.remainingUses !== undefined
          ? token.remainingUses - 1
          : null,
      lastDownloadedAt: now,
    },
  }).catch(() => {});

  // 302 redirect to the actual file
  return NextResponse.redirect(redirectUrl, { status: 302 });
}
