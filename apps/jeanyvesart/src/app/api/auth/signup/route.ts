import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sendMail } from "@acme/core/lib/email"; // ✅ import your email util

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || `User_${Date.now()}`,
      },
    });

    // ✅ Send welcome email (non-blocking if fails)
    try {
      await sendMail({
        to: user.email,
        subject: "Welcome to ZileDigital ✨",
        html: `
          <h2>Welcome${user.name ? `, ${user.name}` : ""}!</h2>
          <p>Thanks for joining our Haitian-inspired digital art community.</p>
          <p>You can now log in and explore artworks, customize digital pieces, and more.</p>
          <p>
            <a href="${
              process.env.NEXT_PUBLIC_APP_URL || "https://ziledigital.com"
            }/profile"
               style="display:inline-block;padding:10px 16px;background:#4f46e5;
                      color:#fff;border-radius:8px;text-decoration:none;">
              Go to your profile
            </a>
          </p>
        `,
        text: `Welcome to ZileDigital${
          user.name ? `, ${user.name}` : ""
        }! Thanks for joining. Log in at ${
          process.env.NEXTAUTH_URL || "https://ziledigital.com"
        }/profile`,
      });
    } catch (err) {
      console.error("Welcome email failed:", err);
    }

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
