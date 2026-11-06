import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@acme/core/lib/prisma";
import { hashEmailToken } from "@acme/core/lib/merchant-totp";
import { jsonBody, invalidInput } from "@/lib/merchant-auth-request";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const parsed = z.object({ token: z.string().min(32).max(128) }).strict().safeParse(await jsonBody(req));
    if (!parsed.success) return invalidInput();
    const tokenHash = hashEmailToken(parsed.data.token);
    const used = await prisma.$transaction(async tx => {
      const challenge = await tx.merchantSignupChallenge.findUnique({ where: { tokenHash }, select: { userId: true, expiresAt: true } });
      if (!challenge || challenge.expiresAt <= new Date()) return false;
      const removed = await tx.merchantSignupChallenge.deleteMany({ where: { tokenHash, expiresAt: { gt: new Date() } } });
      if (removed.count !== 1) return false;
      await tx.user.update({ where: { id: challenge.userId }, data: { emailVerified: new Date() } });
      return true;
    });
    return NextResponse.json({ ok: used }, { status: used ? 200 : 400, headers: { "Cache-Control": "no-store" } });
  } catch { return invalidInput(); }
}
