#!/usr/bin/env python3
"""Verify typed second-factor precondition remains enforced on merchant data."""
import argparse
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('--repo', required=True)
r = Path(p.parse_args().repo).resolve()
read = lambda rel: (r / rel).read_text()
tenancy = read('packages/core/src/lib/tenancy.ts')
principal = read('apps/admin/src/lib/merchant-session.ts')
http = read('apps/admin/src/lib/merchant-http.ts')
tests = read('packages/core/src/lib/tenancy.test.ts')
assert 'status: 401 | 403 | 404 | 428' in tenancy, 'typed MFA status missing'
assert 'new TenantAccessError(428, "Second-factor verification required")' in principal, 'MFA access guard absent'
assert 'verifyMerchantMfaCookie(proof, userId, mfa.version, sessionId)' in principal, 'second-factor proof missing'
assert 'MERCHANT_MFA_REQUIRED' in http and 'error.status === 428' in http, 'MFA response code missing'
assert 'new TenantAccessError(428' in tests, 'regression test missing'
print('ZILEDIGITAL_V37B1_MFA_STATUS_GUARD_PASS')
