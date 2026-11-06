import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@acme/core/lib/prisma";
import { sendMail } from "@acme/core/lib/email";
import { hashEmailToken } from "@acme/core/lib/merchant-totp";
import { requiresMerchantEmailVerification } from "@acme/core/lib/merchant-email-policy";
import { jsonBody, invalidInput } from "@/lib/merchant-auth-request";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const input = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  name: z.string().trim().min(1).max(120), password: z.string().min(12).max(128) }).strict();
export async function GET() {
  return NextResponse.json({ emailVerificationRequired: requiresMerchantEmailVerification(process.env.MERCHANT_EMAIL_VERIFICATION_REQUIRED) },
    { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (process.env.MERCHANT_SELF_SIGNUP_ENABLED !== "true") return NextResponse.json({ error: "Registration is not enabled" }, { status: 503 });
  try {
    const body = input.safeParse(await jsonBody(req));
    if (!body.success) return invalidInput();
    const emailVerificationRequired = requiresMerchantEmailVerification(process.env.MERCHANT_EMAIL_VERIFICATION_REQUIRED);
    const token = emailVerificationRequired ? randomBytes(32).toString("base64url") : null;
    const passwordHash = await hash(body.data.password, 12);
    const result = await prisma.user.create({ data: {
      email: body.data.email, name: body.data.name, passwordHash,
      // When bypass is requested, do NOT fake emailVerified: the email address is still unverified.
      ...(token ? { merchantSignupChallenge: { create: { tokenHash: hashEmailToken(token), expiresAt: new Date(Date.now() + 20 * 60000) } } } : {}),
    }, select: { id: true } }).catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return null;
      throw error;
    });
    if (result && token) {
      const origin = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : req.nextUrl.origin;
      const link = `${origin}/merchant/register#verify=${encodeURIComponent(token)}`;
      try {
        await sendMail({ to: body.data.email, subject: "Verify your merchant account",
          text: `Verify your merchant email by opening: ${link}\nThis link expires in 20 minutes.`,
          html: `<p>Verify your merchant email within 20 minutes.</p><p><a href="${link}">Verify merchant account</a></p>` });
      } catch (error) {
        console.error("Merchant verification email failed", error);
        return NextResponse.json({ error: "Verification email could not be delivered. Use resend to retry." }, { status: 503 });
      }
    }
    return NextResponse.json({ ok: true, message: emailVerificationRequired
      ? "If registration is available, check your email for a verification link."
      : "If your account is available, sign in to continue. No verification email is required." },
      { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch { return invalidInput(); }
}
