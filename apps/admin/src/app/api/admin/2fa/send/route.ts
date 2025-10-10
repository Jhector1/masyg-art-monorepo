// src/app/api/admin/2fa/send/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@acme/core/lib/prisma";
import { sendMail } from "@acme/core/lib/email";
import { issueCode, MFA_CODE_TTL_SEC } from "@/lib/mfa-server";

const RESEND_COOLDOWN_SEC = 60;

export async function POST(req: Request) {
  const session = await auth();
  const u = session?.user as any;
  if (!u?.id || u.isAdmin !== true) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: { email: true },
  });
  if (!user?.email) return NextResponse.json({ error: "No email on file" }, { status: 400 });

  const now = new Date();
  const identifier = `admin-2fa:${u.id}`;

  // 1) If there’s an active code and not forcing, *don’t* send again
  const active = await prisma.verificationToken.findFirst({
    where: { identifier, expires: { gt: now } },
    orderBy: { expires: "desc" },
  });
  if (active && !force) {
    return NextResponse.json({
      ok: true,
      alreadyActive: true,
      expiresAt: active.expires,
    });
  }

  // 2) Optional cooldown (even for force=false and no active)
  const recent = await prisma.verificationToken.findFirst({
    where: { identifier },
    orderBy: { expires: "desc" },
  });
  if (!force && recent && now.getTime() - recent.expires.getTime() < RESEND_COOLDOWN_SEC * 1000) {
    return NextResponse.json(
      { ok: true, throttled: true },
      { status: 202, headers: { "Retry-After": String(RESEND_COOLDOWN_SEC) } }
    );
  }

  // 3) Issue a fresh code and try to email
  const { code, expires } = await issueCode(u.id);

  try {
    await sendMail({
      to: user.email,
      subject: "Your admin verification code",
      html: `<p>Your code is: <b>${code}</b></p><p>Valid ${Math.floor(MFA_CODE_TTL_SEC/60)} minutes.</p>`,
      text: `Your code is: ${code} (valid ${Math.floor(MFA_CODE_TTL_SEC/60)} minutes)`,
    });
    return NextResponse.json({ ok: true, emailed: true, expiresAt: expires });
  } catch (err: any) {
    // The code still exists; user can use it even if email failed
    console.error("sendMail failed:", err?.message || err);
    return NextResponse.json({
      ok: true,
      emailed: false,
      reason: "mail-failed",
      expiresAt: expires,
    });
  }
}
