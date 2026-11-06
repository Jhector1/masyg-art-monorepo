import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@acme/core/lib/prisma";
import { TenantAccessError } from "@acme/core/lib/tenancy";
import { requiresMerchantEmailVerification } from "@acme/core/lib/merchant-email-policy";
import { MERCHANT_MFA_COOKIE, verifyMerchantMfaCookie } from "@/lib/merchant-mfa-cookie";

/** Normal database-backed identity only; emergency admins are NEVER merchant principals. */
export async function requireMerchantIdentity(): Promise<{ userId: string; sessionId: string }> {
  const session = await auth();
  const user = session?.user as { id?: unknown; merchantSessionId?: unknown; isEmergencyAdmin?: boolean } | undefined;
  if (user?.isEmergencyAdmin || typeof user?.id !== "string" || !user.id ||
      typeof user.merchantSessionId !== "string" || !user.merchantSessionId) {
    throw new TenantAccessError(401, "Unauthorized");
  }
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, emailVerified: true } });
  if (!row) throw new TenantAccessError(401, "Unauthorized");
  // Gate existing sessions too if verification is enabled after an account was created.
  if (requiresMerchantEmailVerification(process.env.MERCHANT_EMAIL_VERIFICATION_REQUIRED) && !row.emailVerified)
    throw new TenantAccessError(403, "Email verification required");
  return { userId: row.id, sessionId: user.merchantSessionId };
}

/** Every merchant data read/write and merchant page must pass this guard. */
export async function requireMerchantPrincipal(): Promise<string> {
  const { userId, sessionId } = await requireMerchantIdentity();
  const mfa = await prisma.merchantMfaCredential.findUnique({ where: { userId },
    select: { enabledAt: true, version: true } });
  if (mfa?.enabledAt) {
    const jar = await cookies();
    const proof = jar.get(MERCHANT_MFA_COOKIE)?.value;
    if (!proof || !(await verifyMerchantMfaCookie(proof, userId, mfa.version, sessionId))) {
      throw new TenantAccessError(428, "Second-factor verification required");
    }
  }
  return userId;
}
