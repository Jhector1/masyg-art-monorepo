// src/lib/mfa.ts
import crypto from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import { SignJWT, jwtVerify } from "jose";

const MFA_COOKIE = "mfa_admin";
const MFA_CODE_TTL_SEC = 5 * 60;
const MFA_COOKIE_TTL_SEC = 10 * 60;
const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

export const mfa = {
  cookieName: MFA_COOKIE,
  genCode() {
    return String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
  },
  hash(s: string) {
    return crypto.createHash("sha256").update(s).digest("hex");
  },
  async issueCode(userId: string) {
    const code = mfa.genCode();
    const codeHash = mfa.hash(code);
    const expiresAt = new Date(Date.now() + MFA_CODE_TTL_SEC * 1000);
    await prisma.adminTwoFactor.upsert({
      where: { userId },
      update: { codeHash, expiresAt },
      create: { userId, codeHash, expiresAt },
    });
    return { code, expiresAt };
  },
  async verifyCode(userId: string, code: string) {
    const rec = await prisma.adminTwoFactor.findUnique({ where: { userId } });
    if (!rec || rec.expiresAt < new Date()) return false;
    return mfa.hash(code) === rec.codeHash;
  },
  async signCookie(userId: string) {
    return new SignJWT({ userId, scope: "admin-mfa" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${MFA_COOKIE_TTL_SEC}s`)
      .sign(SECRET);
  },
  async checkCookie(token: string) {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.scope !== "admin-mfa" || typeof payload.userId !== "string") throw new Error("bad-scope");
    return payload.userId as string;
  },
  cookieMaxAge: MFA_COOKIE_TTL_SEC,
};
