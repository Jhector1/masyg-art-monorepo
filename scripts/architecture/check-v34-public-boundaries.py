#!/usr/bin/env python3
"""Guard the v34A public discovery cutover. Read-only, no database connection."""
import json, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[2]
scanner=root/'scripts/architecture/audit-commerce-boundaries.py'
result=subprocess.run([sys.executable,str(scanner),'--repo',str(root),'--json'],capture_output=True,text=True)
if result.returncode != 0:
    print(result.stderr or 'Audit failed',file=sys.stderr);sys.exit(1)
report=json.loads(result.stdout)
counts={kind:sum(i['code']==kind for i in report['issues']) for kind in (
    'APP_LOCAL_BUSINESS_LOGIC','LEGACY_COMMERCE_CLIENT_CALL','LEGACY_COMMERCE_ENDPOINT')}
expected={'APP_LOCAL_BUSINESS_LOGIC':19,'LEGACY_COMMERCE_CLIENT_CALL':11,'LEGACY_COMMERCE_ENDPOINT':14}
for kind,ceiling in expected.items():
    if counts[kind]>ceiling:
        sys.exit(f'REGRESSION {kind}: {counts[kind]} exceeds v34A ceiling {ceiling}')
for app in ('jeanyvesart','ziledigital'):
    prefix=f'apps/{app}/src/app/'
    sitemap=(root/(prefix+'sitemap.xml/route.ts')).read_text()
    meta=(root/(prefix+('store/[id]/metadata.ts' if app=='jeanyvesart' else '(pages)/(public)/store/[id]/metadata.ts'))).read_text()
    media=(root/(prefix+'api/public/stores/[storeId]/media/[assetId]/route.ts')).read_text()
    if 'createPublishedSitemapHandler' not in sitemap or 'publishedProductMetadata' not in meta or 'export { GET } from "@acme/server/api/public/stores/[storeId]/media/[assetId]/route"' not in media:
        sys.exit(f'PUBLIC_DISCOVERY_BOUNDARY_FAIL: {app}')
    if 'prisma.' in sitemap+meta+media:
        sys.exit(f'APP_OWNED_QUERY_FOUND: {app}')
for path,markers in {
    'packages/core/src/lib/public-sitemap.ts':['resolvePublicStoreFromHostHeader','organizationId: store.organizationId','storeId: store.id','status: "PUBLISHED"','take: 500'],
    'packages/core/src/lib/public-media.ts':['resolvePublishedStore','organizationId: store.organizationId','asset: { private: false }','storeId: store.id','storageKey: true'],
    'packages/server/src/lib/public-product-metadata.ts':['resolvePublicStoreFromHostHeader','getPublicProduct','robots: { index: false'],
}.items():
    src=(root/path).read_text()
    if any(marker not in src for marker in markers):sys.exit('MISSING_REQUIRED_AUTHORIZATION_BOUNDARY: '+path)
print('ZILEDIGITAL_V34A_PUBLIC_BOUNDARIES_PASS')
print('ZILEDIGITAL_V34A_REMAINING_FINDINGS',sum(counts.values()),counts)
