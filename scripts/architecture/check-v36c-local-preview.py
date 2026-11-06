#!/usr/bin/env python3
"""Ensure development preview never creates an implicit tenant or a production localhost bypass."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);a=p.parse_args();r=Path(a.repo)
h=(r/'packages/core/src/lib/storefront-host.ts').read_text()
c=(r/'packages/core/src/lib/public-catalog.ts').read_text()
t=(r/'packages/core/src/lib/storefront-host.test.ts').read_text()
v=(r/'packages/core/src/lib/public-catalog-view.ts').read_text()
assert 'process.env.NODE_ENV === "development"' in h
assert 'isLocalPreviewHostHeader' in h
assert 'ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID' in h
assert 'ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID' in h
assert 'resolvePublishedStoreByDomain(hostname)' in h
assert 'resolvePublishedLocalPreviewStore({ organizationId, storeId })' in h
assert 'organizationId: requirePublicStoreId(args.organizationId)' in c
assert 'id: requirePublicStoreId(args.storeId)' in c
assert 'published: true' in c
assert 'where:{id:"store_001",organizationId:"org_001",published:true}' in t
assert 'const mutableNodeEnv = process.env as unknown as { NODE_ENV?: string };' in t
assert 'mutableNodeEnv.NODE_ENV="production"' in t
assert 'process.env.NODE_ENV=' not in t
assert '"localhost.evil.com"' in t
assert 'path === "/api/public/store-context"' in v
assert 'fetchPublishedStore' in v
print('ZILEDIGITAL_V36C_LOCAL_PREVIEW_GUARD_PASS')
