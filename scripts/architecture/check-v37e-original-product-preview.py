#!/usr/bin/env python3

import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--repo',required=True)
r=Path(p.parse_args().repo)
page=(r/'apps/ziledigital/src/app/(pages)/(public)/store/[id]/page.tsx').read_text()
client=(r/'apps/ziledigital/src/app/(pages)/(public)/store/[id]/ProductClient.tsx').read_text()
panel=(r/'apps/ziledigital/src/components/CanonicalArtInfoModel.tsx').read_text()
gallery=(r/'packages/ui/src/components/product/detail/ProductImageGallery.tsx').read_text()
assert 'ProductDetail' in page and 'PublicProductDetail' not in page
for needle in ['ProductImageGallery','fetchPublishedStore','fetchPublishedListing','catalogMediaPath','Preview unavailable']:
 assert needle in client,needle
for needle in ['visibleVariants','addStoreVariant','getStoreCart','setStoreVariantQuantity']:
 assert needle in panel,needle
for banned in ['/api/private/','/api/user/','useProductData','window.location.href','/api/public/products']:
 assert banned not in client and banned not in panel,banned
for needle in ['ProductImagePreviews','ProductImage','ImageSlider']:
 assert needle in gallery,needle
assert 'thumbnails: string[]' in gallery
print('ZILEDIGITAL_V37E_ORIGINAL_PREVIEW_GUARD_PASS')
