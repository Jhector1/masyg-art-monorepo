import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
const cookieName = () => `${process.env.NODE_ENV === "production" ? "__Host-" : ""}ziledigital-admin.merchant-mfa`;
export const MERCHANT_MFA_COOKIE = cookieName();
const ttl = 8 * 60 * 60;
function signingKey() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 24) throw new Error("NEXTAUTH_SECRET is required");
  return createHmac("sha256", value).update("ziledigital/merchant-mfa/v1").digest();
}
export async function signMerchantMfaCookie(userId: string, version: string, sessionId: string) {
  return new SignJWT({ scope: "merchant-mfa", userId, version, sessionId })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${ttl}s`).sign(signingKey());
}
export async function verifyMerchantMfaCookie(token: string, userId: string, version: string, sessionId: string) {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    return payload.scope === "merchant-mfa" && payload.userId === userId &&
      payload.version === version && payload.sessionId === sessionId;
  } catch { return false; }
}
export function writeMerchantMfaCookie(res: import("next/server").NextResponse, signed: string) {
  res.cookies.set({ name: MERCHANT_MFA_COOKIE, value: signed, maxAge: ttl,
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}
export function clearMerchantMfaCookie(res: import("next/server").NextResponse) {
  res.cookies.set({ name: MERCHANT_MFA_COOKIE, value: "", maxAge: 0,
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}
