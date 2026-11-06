#!/usr/bin/env python3
"""Deterministic v29 boundary check; no database or Cloudinary calls."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[2]
files={
 'overview':'apps/admin/src/app/merchant/page.tsx',
 'stores':'apps/admin/src/app/merchant/storefronts/page.tsx',
 'products':'apps/admin/src/app/merchant/products/page.tsx',
 'create':'apps/admin/src/app/merchant/products/new/page.tsx',
 'edit':'apps/admin/src/app/merchant/products/[productId]/page.tsx',
 'media':'apps/admin/src/app/merchant/media/page.tsx',
}
for key,rel in files.items():
 t=(ROOT/rel).read_text()
 assert 'merchantWorkspace(' in t,(key,'missing verified merchant context')
 assert 'dynamic = "force-dynamic"' in t,(key,'missing SSR boundary')
 assert 'prisma.product.findMany(' not in t,(key,'unscoped global query')
assert not (ROOT/'apps/admin/src/components/MerchantCatalogConsole.tsx').exists(),'obsolete mega-page must be removed'
frame=(ROOT/'apps/admin/src/components/ClientFrame.tsx').read_text()
for path in ['/merchant/storefronts','/merchant/products','/merchant/products/new','/merchant/media']:
 assert path in frame,path
assert '#merchant-' not in frame,'old one-page anchor navigation retained'
assert 'useSearchParams' in frame,'store selection not preserved across links'
editor=(ROOT/'apps/admin/src/components/merchant/ProductEditor.tsx').read_text()
for s in ['MerchantMediaStudio','material','format','size','Publish catalog product','Unpublish listing']:
 assert s in editor,s
studio=(ROOT/'apps/admin/src/components/MerchantMediaStudio.tsx').read_text()
for s in ['Set as cover','Select thumbnail','Move left','Move right','Remove from gallery','?size=thumb','Upload private files']:
 assert s in studio,s
core=(ROOT/'packages/core/src/lib/merchant-gallery.ts').read_text()
for s in ['requireMerchantAccess','capability: "manage"','organizationId_productId_assetId','orderedGalleryIds','merchantAuditLog']:
 assert s in core,s
for rel in ['apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/route.ts',
            'apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/[assetId]/route.ts']:
 text=(ROOT/rel).read_text()
 assert 'origin' in text and 'requireMerchantPrincipal' in text,rel
cloud=(ROOT/'packages/server/src/lib/merchant-cloudinary.ts').read_text()
assert 'thumbnail' in cloud and 'parsePublicCloudinaryKey' in cloud
print('ZILEDIGITAL_MERCHANT_V29_BOUNDARIES_PASS')
