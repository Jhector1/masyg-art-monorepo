// src/app/api/auth/forgot/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@acme/core/lib/prisma";
import { sendMail } from "@acme/core/lib/email";
import { buildResetEmail } from "@acme/server/services/buildResetEmail";

const RESET_EXP_MINUTES = 60;

// optional: simple in-memory rate limiter (swap for Redis in prod)
const bucket = new Map<string, { count: number; ts: number }>();
function rateLimit(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const entry = bucket.get(key);
  if (!entry || now - entry.ts > windowMs) {
    bucket.set(key, { count: 1, ts: now });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export async function POST(req: Request) {
  // jitter response time (150–350ms) to blunt timing oracles
  const jitter = 150 + Math.floor(Math.random() * 200);
  try {
    const { email, callbackUrl } = await req.json();
    if (!email) {
      await new Promise(r => setTimeout(r, jitter));
      return NextResponse.json({ ok: true }); // generic
    }

    const identifier = String(email).trim().toLowerCase();

    // Basic rate limit by IP+email (replace with Redis for multi-instance)
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    if (rateLimit(`${ip}:${identifier}`)) {
      await new Promise(r => setTimeout(r, jitter));
      return NextResponse.json({ ok: true }); // generic
    }

    const user = await prisma.user.findUnique({
      where: { email: identifier },
      select: { id: true }, // don’t fetch more than needed
    });

    if (user) {
      // Only create token & send email if the account exists
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + RESET_EXP_MINUTES * 60 * 1000);

      // Keep one active reset at a time
      await prisma.verificationToken.deleteMany({
        where: { identifier, expires: { gt: new Date() } },
      });
      await prisma.verificationToken.create({ data: { identifier, token, expires } });

      const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const url = new URL("/authenticate/reset-password", base);
      url.searchParams.set("token", token);
      if (callbackUrl) url.searchParams.set("callbackUrl", callbackUrl);

      const { html, text } = buildResetEmail({
        resetUrl: url.toString(),
        appName: "ZileDigital",
        expiresMinutes: RESET_EXP_MINUTES,
        supportEmail: "support@ziledigital.com",
        logoUrl: "https://res.cloudinary.com/dqeqbgxvn/image/upload/v1760019128/my-logo_kduty6.svg",
        
      });

      await sendMail({
        to: identifier,
        subject: "Reset your password",
        html,
        text,
      });

      // Optional: structured log for auditing (don’t expose publicly)
      console.log("[forgot] sent reset", { email: identifier, expires: expires.toISOString() });
    } else {
      // Optional: log only (don’t send mail)
      console.log("[forgot] no account for email; skipped send", { email: identifier });
    }

    // Generic success either way
    await new Promise(r => setTimeout(r, jitter));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/auth/forgot error:", e);
    await new Promise(r => setTimeout(r, 120)); // keep timing shape
    return NextResponse.json({ ok: true }); // still generic
  }
}
