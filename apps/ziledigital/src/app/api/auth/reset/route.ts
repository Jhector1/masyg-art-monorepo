// ============================================================
// 7) API: Reset — verify token, set password, consume token
// ============================================================
// File: src/app/api/auth/reset/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@acme/core/lib/prisma";

export async function POST(req: Request) {
  try {
    const { token, newPassword, confirmPassword } = await req.json();
    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const vt = await prisma.verificationToken.findUnique({ where: { token } });
    if (!vt || vt.expires < new Date()) {
      // Clean up if expired or invalid
      await prisma.verificationToken.deleteMany({ where: { token } }).catch(() => {});
      return NextResponse.json({ error: "Invalid or expired link." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: vt.identifier }, select: { id: true } });
    if (!user) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      prisma.verificationToken.delete({ where: { token } }), // consume
    ]);

    return NextResponse.json({ message: "Password updated." });
  } catch (e) {
    console.error("POST /api/auth/reset error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}



// ============================================================
// 9) Notes
// - Set NEXT_PUBLIC_BASE_URL in your env (e.g., https://app.example.com) so the email link is absolute.
// - We reused next-auth's VerificationToken model to avoid schema changes.
// - Frontend handles redirects after success; APIs return JSON only.
// - Add a nav link to /account/change-password where appropriate (e.g., Profile > Security).
