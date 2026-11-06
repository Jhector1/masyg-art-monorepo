-- v37: additive merchant account verification, single self-service ownership, optional TOTP.
CREATE TABLE "ziledigital"."MerchantSignupChallenge" (
 "userId" TEXT NOT NULL PRIMARY KEY,
 "tokenHash" TEXT NOT NULL UNIQUE,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "resendCount" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MerchantSignupChallenge_user_fkey" FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE CASCADE
);
CREATE TABLE "ziledigital"."MerchantOnboardingClaim" (
 "userId" TEXT NOT NULL PRIMARY KEY,
 "organizationId" TEXT NOT NULL UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MerchantOnboardingClaim_user_fkey" FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE CASCADE
);
CREATE TABLE "ziledigital"."MerchantMfaCredential" (
 "userId" TEXT NOT NULL PRIMARY KEY,
 "version" TEXT NOT NULL,
 "secretCiphertext" TEXT NOT NULL,
 "enabledAt" TIMESTAMP(3),
 "pendingExpiresAt" TIMESTAMP(3),
 "lastUsedStep" BIGINT,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0,
 "lockedUntil" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MerchantMfaCredential_user_fkey" FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE CASCADE
);
CREATE TABLE "ziledigital"."MerchantMfaRecoveryCode" (
 "codeHash" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 CONSTRAINT "MerchantMfaRecoveryCode_user_fkey" FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE CASCADE
);
CREATE INDEX "MerchantMfaRecoveryCode_userId_idx" ON "ziledigital"."MerchantMfaRecoveryCode"("userId");
