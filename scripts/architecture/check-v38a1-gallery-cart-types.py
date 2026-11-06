#!/usr/bin/env python3
"""Read-only guard: original Gallery markup + canonical cart data only."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True)
r=Path(p.parse_args().repo)
g=(r/'packages/ui/src/components/store/Gallery.tsx').read_text()
h=(r/'packages/core/src/lib/client/original-ui-catalog.ts').read_text()
t=(r/'packages/core/src/lib/client/original-ui-catalog.test.ts').read_text()
for value in ['grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4','aspect-[4/5]','cartGalleryPresentation(p as CartSelectedItem | OriginalGalleryItem)','cartDisplay?.frame','cartDisplay.material','onRemoveCartVariant']:
 if value not in g:raise SystemExit('GALLERY_RESTORATION_MISSING '+value)
for value in ['export function cartGalleryPresentation','price=item.cartPrice','"attributes" in print','item.compareAtMinor']:
 if value not in h:raise SystemExit('CART_AUTHORITY_MISSING '+value)
for value in ['canonical cart Gallery price','historical cart card reads print labels']:
 if value not in t:raise SystemExit('GALLERY_REGRESSION_TEST_MISSING '+value)
for value in ['(p as CartSelectedItem).price','(p as CartSelectedItem).print?.frame','(p as CartSelectedItem).print?.material']:
 if value in g:raise SystemExit('OBSOLETE_CART_FIELD '+value)
print('ZILEDIGITAL_V38A1_GALLERY_CART_GUARD_PASS')
