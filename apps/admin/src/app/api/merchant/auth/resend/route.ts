import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import { sendMail } from "@acme/core/lib/email";
import { hashEmailToken } from "@acme/core/lib/merchant-totp";
import { requiresMerchantEmailVerification } from "@acme/core/lib/merchant-email-policy";
import { jsonBody, invalidInput } from "@/lib/merchant-auth-request";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (process.env.MERCHANT_SELF_SIGNUP_ENABLED !== "true") return NextResponse.json({ error: "Registration is not enabled" }, { status: 503 });
  if (!requiresMerchantEmailVerification(process.env.MERCHANT_EMAIL_VERIFICATION_REQUIRED))
    return NextResponse.json({ ok: true, message: "Email verification is disabled for this environment." },
      { status: 202, headers: { "Cache-Control": "no-store" } });
  try {
    const parsed = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()) }).strict().safeParse(await jsonBody(req));
    if (!parsed.success) return invalidInput();
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email },
      select: { id: true, emailVerified: true, merchantSignupChallenge: { select: { tokenHash: true, resendCount: true, lastSentAt: true } } } });
    const challenge = user?.merchantSignupChallenge;
    // This case happens after a dev account was created without a challenge, then verification was re-enabled.
    // Claim the unique challenge once, so repeated requests cannot flood outgoing mail.
    if (user && !user.emailVerified && !challenge) {
      const token = randomBytes(32).toString("base64url");
      const created = await prisma.merchantSignupChallenge.create({ data: {
        userId: user.id, tokenHash: hashEmailToken(token), expiresAt: new Date(Date.now() + 20 * 60000),
      } }).then(() => true).catch((error: unknown) => {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return false;
        throw error;
      });
      if (created) {
        const origin = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : req.nextUrl.origin;
        const link = `${origin}/merchant/register#verify=${encodeURIComponent(token)}`;
        await sendMail({ to: parsed.data.email, subject: "Verify your merchant account",
          text: `Verify your merchant email: ${link}`,
          html: `<p><a href="${link}">Verify your merchant account</a> (expires in 20 minutes)</p>` });
      }
    }
    if (user && !user.emailVerified && challenge && challenge.resendCount < 5 &&
        challenge.lastSentAt.getTime() < Date.now() - 60000) {
      const token = randomBytes(32).toString("base64url");
      const changed = await prisma.merchantSignupChallenge.updateMany({ where: {
        userId: user.id, tokenHash: challenge.tokenHash, resendCount: { lt: 5 }, lastSentAt: { lt: new Date(Date.now() - 60000) },
      }, data: { tokenHash: hashEmailToken(token), expiresAt: new Date(Date.now() + 20 * 60000),
        resendCount: { increment: 1 }, lastSentAt: new Date() } });
      if (changed.count === 1) {
        const origin = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : req.nextUrl.origin;
        const link = `${origin}/merchant/register#verify=${encodeURIComponent(token)}`;
        await sendMail({ to: parsed.data.email, subject: "Verify your merchant account", text: `Verify your merchant email: ${link}`, html: `<p><a href="${link}">Verify your merchant account</a> (expires in 20 minutes)</p>` });
      }
    }
    return NextResponse.json({ ok: true, message: "If verification is pending, check your email." },
      { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ ok: true, message: "If verification is pending, check your email." }, { status: 202 }); }
}
