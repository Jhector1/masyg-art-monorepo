#!/usr/bin/env python3
"""Static security contract checks; actual browser, DB and Cloudinary tests remain required."""
from pathlib import Path
r=Path(__file__).resolve().parents[2]
def has(rel,*markers):
  data=(r/rel).read_text()
  for marker in markers:
    if marker not in data: raise SystemExit(f'MISSING_CONTRACT: {rel}: {marker}')
has('packages/server/src/lib/merchant-cloudinary.ts','requireMerchantAccess','retired.count !== 1','asset_folder: folder','transformation: incoming','previous.storageKey','destroyDetachedPublicPreview','cloudinary:${kind}:${visibility}:${publicId}')
has('packages/core/src/lib/merchant-media-metadata.ts','requireMerchantAccess','retiredAt: null','retiredAt: new Date()','retired.count !== 1','altText')
for rel in ['public-catalog.ts','checkout-transaction.ts','cart-service.ts']:
  has('packages/core/src/lib/'+rel,'retiredAt:null' if rel=='cart-service.ts' else 'retiredAt: null')
has('packages/core/src/lib/catalog-lifecycle.ts','retiredAt: null')
has('packages/db/prisma/schema.prisma','altText        String?','retiredAt      DateTime?')
has('apps/admin/src/components/MerchantMediaStudio.tsx','Replace selected preview','Save alt text','Local source preview','Upload replacement file','Retire')
has('apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/digital-files/[digitalFileId]/route.ts','requireMerchantPrincipal','retireMerchantDigitalFile','origin')
for rel in ['apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/route.ts','apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/[assetId]/route.ts']:
  has(rel,'origin','requireMerchantPrincipal')
print('ZILEDIGITAL_V31_STATIC_CONTRACT_PASS')
