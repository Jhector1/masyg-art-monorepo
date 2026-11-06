#!/usr/bin/env python3
"""Read-only architecture guard for ZileDigital v39A pricing/offer/bundle groundwork."""
import argparse
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--repo',required=True)
a=p.parse_args()
root=Path(a.repo).resolve(strict=True)
files={
 'packages/core/src/lib/universal-offerings.ts':('conservativeExistingOffering','groupOfferings','assertOfferingFulfillment','DOWNLOAD','MERCHANDISE'),
 'packages/core/src/lib/promotion-pricing.ts':('previewNonStackingDiscounts','TENANT_SCOPE_MISMATCH','BigInt','discountMinor','non','MAX_MINOR'),
 'packages/core/src/lib/fixed-bundle-policy.ts':('previewFixedBundle','TENANT_SCOPE_MISMATCH','MISSING_PRIVATE_FILE','OUT_OF_STOCK','BigInt','ALLOCATION_ERROR'),
}
for name,markers in files.items():
 path=root/name
 if not path.is_file():raise SystemExit(f'MISSING {name}')
 content=path.read_text()
 if any(token not in content for token in markers):raise SystemExit(f'REGRESSION {name}')
 print('PASS',name)
for name in ('packages/core/src/lib/universal-offerings.test.ts',
 'packages/core/src/lib/promotion-pricing.test.ts','packages/core/src/lib/fixed-bundle-policy.test.ts'):
 if not (root/name).is_file():raise SystemExit(f'MISSING {name}')
 print('PASS',name)
print('ZILEDIGITAL_V39A_SAFE_FOUNDATION_GUARD_PASS')
