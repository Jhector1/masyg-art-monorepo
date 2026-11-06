#!/usr/bin/env python3
"""v35A: verify no old checkout/claim logic remains in JeanYves routes."""
from pathlib import Path
import subprocess, json, collections, sys
root=Path(__file__).resolve().parents[2]
removed=['apps/jeanyvesart/src/app/api/orders/by-session/route.ts', 'apps/jeanyvesart/src/app/api/checkout/success/route.ts', 'apps/jeanyvesart/src/app/api/checkout/resume/route.ts', 'apps/jeanyvesart/src/app/api/private/checkout/success/route.ts', 'apps/jeanyvesart/src/app/api/private/checkout/resume/route.ts', 'apps/jeanyvesart/src/app/api/designs/purchases/route.ts', 'apps/jeanyvesart/src/app/api/designs/purchases/[id]/refresh-preview/route.ts', 'apps/jeanyvesart/src/app/api/public/products/[id]/reviews/__tests__/route.get.test.ts']
for f in removed:
 if (root/f).exists():sys.exit('RETIRED_ROUTE_PRESENT '+f)
needed={
 'packages/core/src/lib/customer-checkout-session.ts':['providerSessionId','organizationId:store.organizationId','customer:{is:{userId:args.userId}}','status:order.status','processing:order.status === "PENDING"'],
 'packages/server/src/api/public/stores/[storeId]/orders/by-session/route.ts':['getServerSession','resolvePublicStoreFromHostHeader','published.id!==storeId','getBuyerCheckoutSession'],
 'apps/jeanyvesart/src/app/cart/checkout/success/CheckoutSuccessClient.tsx':['getCurrentStorefront','orders/by-session','Payment confirmed','Your payment is still being verified'],
 'apps/jeanyvesart/src/app/api/public/stores/[storeId]/orders/by-session/route.ts':['export { GET } from "@acme/server/api/public/stores/[storeId]/orders/by-session/route";'],
 'apps/ziledigital/src/app/api/public/stores/[storeId]/orders/by-session/route.ts':['export { GET } from "@acme/server/api/public/stores/[storeId]/orders/by-session/route";'],
}
for file, tokens in needed.items():
 p=root/file
 if not p.is_file():sys.exit('MISSING_SOURCE '+file)
 data=p.read_text()
 for token in tokens:
  if token not in data:sys.exit('MISSING_BOUNDARY '+file+' '+token)
for f in (root/'apps/jeanyvesart/src').rglob('*.tsx'):
 if '/api/user/orders/by-session' in f.read_text():sys.exit('RETIRED_CLIENT_STILL_PRESENT '+str(f))
result=subprocess.run([sys.executable,str(root/'scripts/architecture/audit-commerce-boundaries.py'),'--repo',str(root),'--json'],capture_output=True,text=True)
if result.returncode:sys.exit('AUDIT_FAILED '+result.stderr)
issues=json.loads(result.stdout)['issues'];counts=collections.Counter(row['code'] for row in issues)
for code, ceiling in {'APP_LOCAL_BUSINESS_LOGIC':3,'LEGACY_COMMERCE_ENDPOINT':4,'LEGACY_COMMERCE_CLIENT_CALL':3}.items():
 if counts[code]>ceiling:sys.exit('ARCHITECTURE_REGRESSION '+code+f' {counts[code]} > {ceiling}')
print('ZILEDIGITAL_V35A_SESSION_BOUNDARIES_PASS')
print('ZILEDIGITAL_V35A_REMAINING_FINDINGS',len(issues),dict(counts))
