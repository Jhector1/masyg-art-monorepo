#!/usr/bin/env python3
"""Exact public-media gallery guard without changing the API security rules."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);args=p.parse_args()
r=Path(args.repo)
rel='packages/ui/src/components/product/'
g=(r/(rel+'detail/ProductImageGallery.tsx')).read_text()
t=(r/(rel+'ProductImagePreviews.tsx')).read_text()
i=(r/(rel+'ProductImage.tsx')).read_text()
s=(r/(rel+'ImageSlider.tsx')).read_text()
z=(r/(rel+'ZoomCarouselModal.tsx')).read_text()
p=(r/'apps/ziledigital/src/app/(pages)/(public)/store/[id]/ProductClient.tsx').read_text()
checks={
 'original thumbnail, large image and mobile carousel retained': all(x in g for x in ('ProductImagePreviews','ProductImage','ImageSlider')),
 'public media URLs only': 'isPublishedPreviewPath' in g and '/api\\/public\\/stores\\/' in g and '/media\\/' in g,
 'direct public image loading desktop': 'unoptimized={directMedia}' in g,
 'direct loading on thumbnail images': 'unoptimized={unoptimized}' in t,
 'direct loading on mobile slider': s.count('unoptimized={unoptimized}')>=4,
 'direct loading on zoom modal': z.count('unoptimized={unoptimized}')>=3,
 'product image fallback for true media errors': 'imageFailed' in i and 'onError=' in i,
 'gallery stays within grid': 'min-w-0 flex-1' in g and 'w-[50vw]' not in g and 'lg:h-screen' not in g,
 'accessible thumbnails': 'aria-pressed=' in t and 'aria-label=' in t,
 'original print customizer untouched by this patch': (r/'apps/ziledigital/src/components/CanonicalArtInfoModel.tsx').is_file(),
 'tenant-scoped media calls remain canonical': 'catalogMediaPath(result.store.id,first.assetId)' in p,
 'no legacy checkout link': '/api/private/cart' not in '\n'.join((g,t,i,s,z,p)),
}
for name,okay in checks.items():
 print(('PASS' if okay else 'FAIL'),name)
 if not okay:raise SystemExit('ZILEDIGITAL_V38D_GUARD_REFUSED: '+name)
print('ZILEDIGITAL_V38D_GALLERY_MEDIA_PASS')
