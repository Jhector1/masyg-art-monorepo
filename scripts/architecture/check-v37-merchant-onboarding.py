#!/usr/bin/env python3
"""Regression guards for self-service merchant ownership and optional, enforced MFA."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);a=p.parse_args()
r=Path(a.repo).resolve(strict=True)
def content(path):
 target=r/path
 assert target.is_file(),f'MISSING {path}'
 return target.read_text()
schema=content('packages/db/prisma/schema.prisma')
for model in ('MerchantSignupChallenge','MerchantOnboardingClaim','MerchantMfaCredential','MerchantMfaRecoveryCode'):
 assert f'model {model} ' in schema,model
migration=content('packages/db/prisma/migrations/0007_merchant_self_onboarding_mfa/migration.sql')
for name in ('MerchantSignupChallenge','MerchantOnboardingClaim','MerchantMfaCredential','MerchantMfaRecoveryCode'):
 assert f'"{name}"' in migration
assert '"ziledigital"' in migration
assert 'merchantOnboardingClaim.create' in content('packages/core/src/lib/tenancy.ts')
assert 'role: "OWNER"' in content('packages/core/src/lib/tenancy.ts')
identity=content('apps/admin/src/lib/merchant-session.ts')
for phrase in ('isEmergencyAdmin','verifyMerchantMfaCookie','merchantMfaCredential.findUnique','TenantAccessError(428'):
 assert phrase in identity,phrase
jwt=content('apps/admin/src/lib/auth.ts')
for phrase in ('merchantSessionId','requiresMerchantEmailVerification','email_verified','randomUUID()'):
 assert phrase in jwt,phrase
middleware=content('apps/admin/src/middleware.ts')
assert 'token.isEmergencyAdmin === true' in middleware
assert 'path === "/merchant/register"' in middleware
assert 'path === "/api/merchant/auth/register"' in middleware
for path,phrases in {
 'apps/admin/src/app/api/merchant/auth/register/route.ts':('MERCHANT_SELF_SIGNUP_ENABLED','hashEmailToken(token)','await jsonBody(req)'),
 'apps/admin/src/app/api/merchant/auth/verify/route.ts':('merchantSignupChallenge.deleteMany','emailVerified: new Date()'),
 'apps/admin/src/app/api/merchant/auth/resend/route.ts':('resendCount: { lt: 5 }','lastSentAt: { lt:'),
 'apps/admin/src/app/api/merchant/organizations/route.ts':('MERCHANT_PROVISIONING_ENABLED','requiresMerchantEmailVerification','requireMerchantPrincipal'),
 'apps/admin/src/lib/merchant-mfa-cookie.ts':('merchant-mfa','sessionId','httpOnly: true'),
 'apps/admin/src/lib/merchant-mfa-service.ts':('matchingTotpStep','hashRecoveryCode','lastUsedStep: { lt: BigInt(validTotp) }', 'merchantMfaRecoveryCode.deleteMany'),
 'packages/core/src/lib/merchant-totp.ts':('aes-256-gcm','timingSafeEqual','NEXTAUTH_SECRET','ZILEDIGITAL_MERCHANT_MFA_ENCRYPTION_KEY'),
 'apps/admin/src/app/api/merchant/security/disable/route.ts':('requireMerchantPrincipal','disableMerchantMfa'),
}.items():
 source=content(path)
 for phrase in phrases: assert phrase in source,(path,phrase)
for path in ['apps/admin/src/app/merchant/register/page.tsx','apps/admin/src/app/merchant/onboarding/page.tsx','apps/admin/src/app/merchant/security/page.tsx']:
 assert content(path)
assert 'requireMerchantPrincipal' in content('apps/admin/src/lib/merchant-workspace.ts')
print('ZILEDIGITAL_V37_MERCHANT_SECURITY_BOUNDARIES_PASS')
