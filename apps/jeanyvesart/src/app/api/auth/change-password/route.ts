// src/app/auth/change-password/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import {prisma} from "@acme/core/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { oldPassword, newPassword, confirmPassword } = await req.json();

    if (!oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, password: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
// after
if (!user?.password) {
  return NextResponse.json(
    { error: "This account doesn't have a password set. Use the 'Set Password' flow first." },
    { status: 400 }
  );
}
    const validOld = await bcrypt.compare(oldPassword, user.password);
    if (!validOld) {
      return NextResponse.json({ error: "Old password is incorrect." }, { status: 403 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return NextResponse.json({ message: "Password changed successfully." }, { status: 200 });
  } catch (e) {
    console.error("POST /auth/change-password error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
