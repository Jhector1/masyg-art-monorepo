#!/usr/bin/env python3
"""Verify no email-verification bypass impersonates a verified identity."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);r=Path(p.parse_args().repo)
read=lambda x:(r/x).read_text()
policy=read('packages/core/src/lib/merchant-email-policy.ts')
register=read('apps/admin/src/app/api/merchant/auth/register/route.ts')
resend=read('apps/admin/src/app/api/merchant/auth/resend/route.ts')
auth=read('apps/admin/src/lib/auth.ts')
principal=read('apps/admin/src/lib/merchant-session.ts')
org=read('apps/admin/src/app/api/merchant/organizations/route.ts')
ui=read('apps/admin/src/app/merchant/register/page.tsx')
assert 'setting !== "false"' in policy
assert 'emailVerificationRequired ? randomBytes(32)' in register
assert '...(token ? { merchantSignupChallenge:' in register
assert 'emailVerified: new Date()' not in register  # Do not fabricate email ownership when bypassed.
assert 'if (result && token)' in register and 'await sendMail' in register
assert 'emailVerificationRequired: requiresMerchantEmailVerification' in register
assert 'if (!requiresMerchantEmailVerification' in resend
assert 'if (user && !user.emailVerified && !challenge)' in resend
assert 'requiresMerchantEmailVerification' in auth and '!user.emailVerified' in auth
assert 'requiresMerchantEmailVerification' in principal and '!row.emailVerified' in principal
assert 'requiresMerchantEmailVerification' in org and '!user?.emailVerified' in org
assert 'emailVerificationRequired !== false && <section' in ui
assert 'MERCHANT_SELF_SIGNUP_ENABLED' in register and 'MERCHANT_PROVISIONING_ENABLED' in org
print('ZILEDIGITAL_V37B_EMAIL_POLICY_BOUNDARIES_PASS')
