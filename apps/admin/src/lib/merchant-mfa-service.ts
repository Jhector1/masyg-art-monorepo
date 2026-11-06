import { randomUUID } from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import {
  newTotpSecret, encryptTotpSecret, decryptTotpSecret, matchingTotpStep,
  newRecoveryCodes, hashRecoveryCode,
} from "@acme/core/lib/merchant-totp";
export class MerchantMfaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function beginMerchantMfaEnrollment(userId: string, email: string) {
  const existing = await prisma.merchantMfaCredential.findUnique({ where: { userId }, select: { enabledAt: true } });
  if (existing?.enabledAt) throw new MerchantMfaError(409, "2FA is already enabled");
  const secret = newTotpSecret();
  const secretCiphertext = encryptTotpSecret(secret); // Require an encryption key before writing.
  if (existing) {
    const changed = await prisma.merchantMfaCredential.updateMany({ where: { userId, enabledAt: null },
      data: { version: randomUUID(), secretCiphertext, pendingExpiresAt: new Date(Date.now() + 10*60000),
        lastUsedStep: null, failedAttempts: 0, lockedUntil: null } });
    if (changed.count !== 1) throw new MerchantMfaError(409, "2FA is already enabled");
  } else {
    try {
      await prisma.merchantMfaCredential.create({ data: { userId, version: randomUUID(),
        secretCiphertext, pendingExpiresAt: new Date(Date.now() + 10*60000) } });
    } catch (error) {
      // A concurrent enrollment may have won the unique-user constraint.
      if (typeof error === "object" && error && "code" in error && error.code === "P2002")
        throw new MerchantMfaError(409, "A setup is already in progress. Try again.");
      throw error;
    }
  }
  const label = encodeURIComponent(`ZileDigital:${email}`);
  const issuer = encodeURIComponent("ZileDigital Merchant");
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return { secret, uri, expiresInSeconds: 600 };
}
async function recordFailedAttempt(userId: string, currentFailures: number) {
  await prisma.merchantMfaCredential.updateMany({ where: { userId, failedAttempts: currentFailures },
    data: { failedAttempts: { increment: 1 },
      ...(currentFailures >= 4 ? { lockedUntil: new Date(Date.now() + 15*60000) } : {}) },
  });
}
export async function finishMerchantMfaEnrollment(userId: string, code: string) {
  const row = await prisma.merchantMfaCredential.findUnique({ where: { userId } });
  if (!row || row.enabledAt || !row.pendingExpiresAt || row.pendingExpiresAt <= new Date())
    throw new MerchantMfaError(400, "Start a new 2FA setup");
  if (row.lockedUntil && row.lockedUntil > new Date()) throw new MerchantMfaError(429, "Too many attempts. Try later.");
  const matched = matchingTotpStep(decryptTotpSecret(row.secretCiphertext), code);
  if (matched === null) {
    await recordFailedAttempt(userId, row.failedAttempts);
    throw new MerchantMfaError(400, "Invalid verification code");
  }
  const codes = newRecoveryCodes();
  const updated = await prisma.$transaction(async tx => {
    const changed = await tx.merchantMfaCredential.updateMany({ where: {
      userId, version: row.version, enabledAt: null, pendingExpiresAt: { gt: new Date() },
    }, data: { enabledAt: new Date(), pendingExpiresAt: null,
      lastUsedStep: BigInt(matched), failedAttempts: 0, lockedUntil: null } });
    if (changed.count !== 1) return false;
    await tx.merchantMfaRecoveryCode.createMany({ data: codes.map(value => ({ userId, codeHash: hashRecoveryCode(value) })) });
    return true;
  });
  if (!updated) throw new MerchantMfaError(409, "Enrollment was already completed");
  return { version: row.version, recoveryCodes: codes };
}
/** Accepted codes are consumed atomically, including TOTP time-step replay. */
export async function verifyMerchantSecondFactor(userId: string, code: string): Promise<string> {
  const row = await prisma.merchantMfaCredential.findUnique({ where: { userId } });
  if (!row?.enabledAt) throw new MerchantMfaError(400, "2FA is not enabled");
  if (row.lockedUntil && row.lockedUntil > new Date()) throw new MerchantMfaError(429, "Too many attempts. Try later.");
  const validTotp = /^\d{6}$/.test(code)
    ? matchingTotpStep(decryptTotpSecret(row.secretCiphertext), code) : null;
  if (validTotp !== null) {
    const changed = await prisma.merchantMfaCredential.updateMany({ where: {
      userId, version: row.version, enabledAt: { not: null },
      OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: BigInt(validTotp) } }],
    }, data: { lastUsedStep: BigInt(validTotp), failedAttempts: 0, lockedUntil: null } });
    if (changed.count === 1) return row.version;
  }
  if (/^[A-Fa-f0-9]{20}$/.test(code)) {
    const hash = hashRecoveryCode(code);
    const removed = await prisma.$transaction(async tx => {
      const gone = await tx.merchantMfaRecoveryCode.deleteMany({ where: { userId, codeHash: hash } });
      if (gone.count !== 1) return false;
      await tx.merchantMfaCredential.update({ where: { userId }, data: { failedAttempts: 0, lockedUntil: null } });
      return true;
    });
    if (removed) return row.version;
  }
  await recordFailedAttempt(userId, row.failedAttempts);
  throw new MerchantMfaError(400, "Invalid or already-used code");
}
export async function disableMerchantMfa(userId: string, code: string) {
  await verifyMerchantSecondFactor(userId, code);
  await prisma.$transaction(async tx => {
    await tx.merchantMfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.merchantMfaCredential.delete({ where: { userId } });
  });
}
