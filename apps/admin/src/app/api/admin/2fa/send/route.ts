export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@acme/core/lib/prisma";
import { sendMail } from "@acme/core/lib/email";
import { issueCode } from "@/lib/mfa-server";

export async function POST() {
  const session = await auth();
  const u = session?.user as any;
  if (!u?.id || u.isAdmin !== true) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = (await prisma.user.findUnique({ where: { id: u.id }, select: { email: true } })) ?? {};
  if (!email) return NextResponse.json({ error: "No email on file" }, { status: 400 });

  const { code, expires } = await issueCode(u.id);
  await sendMail({ to: email, subject: "Your admin verification code",
    html: `<p>Your code is: <b>${code}</b></p><p>Valid 5 minutes.</p>`,
    text: `Your code is: ${code} (valid 5 minutes)` });
  return NextResponse.json({ ok: true, expiresAt: expires });
}
