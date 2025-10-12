// src/app/api/admin/2fa/verify/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  verifyCode,
  signMfaCookie,
  MFA_COOKIE,
  MFA_COOKIE_TTL_SEC,
} from "@/lib/mfa-server";

export async function POST(req: Request) {
  const session = await auth();
  const u = session?.user as any;
  if (!u?.id || u.isAdmin !== true) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json().catch(() => ({}));
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const ok = await verifyCode(u.id, code);
  if (!ok) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  const token = await signMfaCookie(u.id);
  const jar = cookies(); // no await needed

  jar.set({
    name: MFA_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NEXT_ENV === "prod",
    path: "/",
    maxAge: MFA_COOKIE_TTL_SEC,
  });

  // Let the client handle where to go next (see UI change below)
  return NextResponse.json({ ok: true });
}
