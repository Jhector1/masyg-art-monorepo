// src/lib/mfa-server.ts
import { SignJWT } from "jose";
import { prisma } from "@acme/core/lib/prisma";
import crypto from "crypto";

export const MFA_COOKIE = "mfa_admin";

export const MFA_CODE_TTL_SEC = 5 * 60;                 // OTP valid 5 min
export const MFA_COOKIE_TTL_SEC = 24 * 60 * 60;         // 1 day (no remember)
export const MFA_REMEMBER_COOKIE_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

const code6 = () => String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const keyFor = (userId: string) => `admin-2fa:${userId}`;

// unchanged
export async function issueCode(userId: string) {
  const code = code6();
  const expires = new Date(Date.now() + MFA_CODE_TTL_SEC * 1000);
  await prisma.verificationToken.create({
    data: { identifier: keyFor(userId), token: hash(code), expires },
  });
  return { code, expires };
}

export async function verifyCode(userId: string, code: string) {
  const rec = await prisma.verificationToken.findFirst({
    where: { identifier: keyFor(userId) },
    orderBy: { expires: "desc" },
  });
  if (!rec || rec.expires < new Date()) return false;
  const ok = rec.token === hash(code);
  if (ok) {
    await prisma.verificationToken.delete({ where: { token: rec.token } });
  }
  return ok;
}

// ⬇️ now supports remember flag
export async function signMfaCookie(userId: string, remember = false) {
  const ttl = remember ? MFA_REMEMBER_COOKIE_TTL_SEC : MFA_COOKIE_TTL_SEC;

  return new SignJWT({ scope: "admin-mfa", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(SECRET);
}
