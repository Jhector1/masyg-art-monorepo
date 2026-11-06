#!/usr/bin/env python3
"""Read-only v34C source contract checks. No DB or provider access."""
from pathlib import Path
import subprocess,json,collections,sys
r=Path(__file__).resolve().parents[2]
required={
 'packages/core/src/lib/customer-addresses.ts': ['resolvePublishedStore','organizationId','storeId','userId','deleteMany','Serializable','customerAddressInput'],
 'packages/server/src/lib/customer-address-route.ts':['getServerSession','resolvePublicStoreFromHostHeader','req.headers.get("host")'],
 'packages/server/src/api/public/addresses/route.ts':['Invalid request origin','application/json','createCustomerAddress'],
 'packages/server/src/api/public/addresses/[id]/route.ts':['Invalid request origin','deleteCustomerAddress'],
 'apps/jeanyvesart/src/app/profile/page.tsx':['/api/auth/profile','/api/auth/change-password','readOnly'],
 'packages/db/prisma/schema.prisma':['model CustomerAddress','@@index([organizationId, storeId, userId, createdAt])'],
 'packages/db/prisma/migrations/0005_customer_addresses/migration.sql':['FOREIGN KEY ("organizationId", "storeId")','"CustomerAddress"'],
}
for rel,tokens in required.items():
 p=r/rel
 if not p.is_file():sys.exit('MISSING_SOURCE '+rel)
 s=p.read_text()
 for token in tokens:
  if token not in s:sys.exit('MISSING_BOUNDARY '+rel+' '+token)
for app in ('jeanyvesart','ziledigital'):
 for path,methods in [('addresses/route.ts','GET,POST'),('addresses/[id]/route.ts','DELETE')]:
  text=(r/f'apps/{app}/src/app/api/{path}').read_text()
  if f'export {{{methods}}} from "@acme/server/api/public/' not in text:sys.exit('UNSHARED_ADDRESS_HANDLER '+app)
for dead in ('apps/jeanyvesart/src/app/api/orders/route.ts','apps/jeanyvesart/src/app/api/orders/[orderId]/route.ts'):
 if (r/dead).exists():sys.exit('UNUSED_LEGACY_ORDER_ROUTE '+dead)
audit=subprocess.run([sys.executable,str(r/'scripts/architecture/audit-commerce-boundaries.py'),'--repo',str(r),'--json'],capture_output=True,text=True)
if audit.returncode:sys.exit(audit.stderr)
counts=collections.Counter(x['code'] for x in json.loads(audit.stdout)['issues'])
ceil={'APP_LOCAL_BUSINESS_LOGIC':13,'LEGACY_COMMERCE_CLIENT_CALL':9,'LEGACY_COMMERCE_ENDPOINT':12}
for k,v in ceil.items():
 if counts[k]>v:sys.exit(f'CUTOVER_REGRESSION {k} {counts[k]}>{v}')
print('ZILEDIGITAL_V34C_CUSTOMER_BOUNDARIES_PASS')
print('ZILEDIGITAL_V34C_REMAINING_FINDINGS',sum(counts.values()),dict(counts))
