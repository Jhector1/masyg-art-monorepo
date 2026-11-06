#!/usr/bin/env python3
"""Read-only contract + cutover guard for first v34B migration. No DB access."""
from pathlib import Path
import sys,subprocess,json,collections
root=Path(__file__).resolve().parents[2]
report=subprocess.run([sys.executable,str(root/'scripts/architecture/audit-commerce-boundaries.py'),
    '--repo',str(root),'--json'],capture_output=True,text=True)
if report.returncode:sys.exit(report.stderr or 'Architecture scan failed')
issues=json.loads(report.stdout)['issues']
counts=collections.Counter(i['code'] for i in issues)
ceilings={'APP_LOCAL_BUSINESS_LOGIC':17,'LEGACY_COMMERCE_CLIENT_CALL':9,'LEGACY_COMMERCE_ENDPOINT':14}
for code,ceiling in ceilings.items():
    if counts[code]>ceiling:sys.exit(f'CUTOVER_REGRESSION {code} {counts[code]} > {ceiling}')
required={
  'apps/ziledigital/src/app/(pages)/(public)/store/StoreClient.tsx':'PublishedGallery',
  'apps/jeanyvesart/src/app/store/page.tsx':'OriginalCatalogGrid',
  'apps/jeanyvesart/src/app/page.tsx':'OriginalCatalogGrid',
  'apps/ziledigital/src/app/(pages)/(public)/store/[id]/page.tsx':'ProductDetail',
  'apps/jeanyvesart/src/app/store/[id]/page.tsx':'OriginalArtworkDetails',
  'packages/ui/src/components/storefront/PublicProductDetail.tsx':'/api/public/stores/',
  'packages/ui/src/components/storefront/PublicCatalog.tsx':'fetchPublishedListings',
  'packages/core/src/lib/public-catalog-view.ts':'/api/public/store-context',
  'packages/core/src/lib/product-capabilities.ts':'getFulfillmentCapabilities',
  'packages/server/src/api/auth/profile/route.ts':'passwordHash',
}
for f,marker in required.items():
    source=(root/f).read_text()
    if marker not in source:sys.exit(f'MISSING_BOUNDARY {f}: {marker}')
# Later cutover moves the reset handler from app-local Prisma to shared server
# while keeping the original v34B passwordHash security intent.
reset_adapter=(root/'apps/ziledigital/src/app/api/auth/reset/route.ts').read_text()
if 'export { POST } from "@acme/server/api/auth/reset/route";' in reset_adapter:
    reset_server=(root/'packages/server/src/api/auth/reset/route.ts').read_text()
    if 'passwordHash' not in reset_server or 'verificationToken.deleteMany' not in reset_server:
        sys.exit('PASSWORD_RESET_SHARED_HANDLER_REGRESSION')
elif 'data: { passwordHash: hashed }' not in reset_adapter:
    sys.exit('PASSWORD_RESET_HASH_REGRESSION')
for app in ('ziledigital','jeanyvesart'):
    s=(root/f'apps/{app}/src/app/api/auth/profile/route.ts').read_text()
    if 'export { GET, PATCH } from "@acme/server/api/auth/profile/route";' not in s or 'prisma' in s:
        sys.exit(f'PROFILE_ROUTE_NOT_CANONICAL {app}')
for file in (
  'apps/jeanyvesart/src/app/page.tsx',
  'apps/jeanyvesart/src/app/store/page.tsx',
  'apps/ziledigital/src/app/(pages)/(public)/store/StoreClient.tsx'):
    data=(root/file).read_text()
    if '/api/products' in data or 'prisma.' in data or 'serverFetchJSON' in data:
        sys.exit(f'STOREFRONT_LEGACY_READ {file}')
server=(root/'packages/server/src/api/auth/profile/route.ts').read_text()
for item in ('getServerSession','req.headers.get("origin")','requireSameOriginJson','data:{image}','cloudinary.uploader.upload_stream','Email changes require verified email confirmation'):
    if item not in server:sys.exit('PROFILE_SECURITY_MISSING '+item)
for file in ('apps/ziledigital/src/app/(pages)/(public)/cart/page.tsx',
             'apps/jeanyvesart/src/app/cart/page.tsx'):
    source=(root/file).read_text()
    if file.startswith('apps/ziledigital/'):
        if not all(token in source for token in ('useStoreCart','StripeTestCheckoutControl','projectOriginalCartItems','onRemoveCartVariant')):
            sys.exit('CART_REGRESSION '+file)
    elif 'CanonicalCartView' not in source:sys.exit('CART_REGRESSION '+file)
print('ZILEDIGITAL_V34B_CANONICAL_CATALOG_BOUNDARIES_PASS')
print('ZILEDIGITAL_V34B_REMAINING_FINDINGS',sum(counts.values()),dict(counts))
