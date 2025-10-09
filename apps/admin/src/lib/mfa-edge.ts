// src/lib/mfa-edge.ts
import { jwtVerify } from "jose";

export const MFA_COOKIE = "mfa_admin";
export const MFA_COOKIE_TTL_SEC = 10 * 60;

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

export async function checkMfaCookie(cookie: string) {
  const { payload } = await jwtVerify(cookie, SECRET);
  if (payload.scope !== "admin-mfa" || typeof payload.userId !== "string") {
    throw new Error("bad-scope");
  }
  return {
    userId: payload.userId as string,
    iat: typeof payload.iat === "number" ? payload.iat : 0,
  };
}
