#!/usr/bin/env python3
"""Check merchant entry routing, no change to emergency admin isolation, and repaired readonly Node env test."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);a=p.parse_args()
r=Path(a.repo)
read=lambda rel:(r/rel).read_text()
mid=read('apps/admin/src/middleware.ts')
login=read('apps/admin/src/app/merchant/signin/page.tsx')
register=read('apps/admin/src/app/merchant/register/page.tsx')
auth=read('apps/admin/src/lib/auth.ts')
test=read('packages/core/src/lib/storefront-host.test.ts')
assert '"/merchant/signin"' in mid and '"/merchant/register"' in mid and 'isMerchant ? "/merchant/signin" : "/api/auth/signin"' in mid
assert 'if (token.isEmergencyAdmin === true)' in mid and 'new NextResponse("Forbidden", { status: 403 })' in mid
assert 'getToken({ req' in mid and 'getAdminSessionCookieName()' in mid
assert 'signIn("credentials"' in login and 'signIn("google"' in login and 'Create an account' in login
assert 'url.origin !== window.location.origin' in login and 'raw.startsWith("//")' in login
assert 'href="/merchant/signin?callbackUrl=/merchant/onboarding"' in register
assert 'validateEmergencyAdminCredentials' in auth and 'name: "Email and password"' in auth
assert 'const mutableNodeEnv = process.env as unknown as { NODE_ENV?: string };' in test
assert 'process.env.NODE_ENV=' not in test and 'delete process.env.NODE_ENV' not in test
print('ZILEDIGITAL_V37A_MERCHANT_SIGNIN_GUARD_PASS')
