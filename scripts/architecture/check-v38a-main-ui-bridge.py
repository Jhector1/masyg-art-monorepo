#!/usr/bin/env python3
"""Read-only UI-origin and tenant-boundary guard for main -> canonical adaptation."""
import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--repo',required=True)
r=Path(p.parse_args().repo).resolve()
def source(rel):
 f=r/rel
 if not f.is_file():raise SystemExit('MISSING_'+rel)
 return f.read_text()
store=source('apps/ziledigital/src/app/(pages)/(public)/store/StoreClient.tsx')
fav=source('apps/ziledigital/src/app/(pages)/(private)/favorites/page.tsx')
cart=source('apps/ziledigital/src/app/(pages)/(public)/cart/page.tsx')
gallery=source('packages/ui/src/components/store/Gallery.tsx')
original=source('packages/ui/src/components/storefront/OriginalPublishedGallery.tsx')
product=source('apps/ziledigital/src/app/(pages)/(public)/store/[id]/ProductClient.tsx')
panel=source('apps/ziledigital/src/components/CanonicalArtInfoModel.tsx')
adapter=source('packages/core/src/lib/client/original-ui-catalog.ts')
checkout=source('packages/ui/src/components/cart/StripeTestCheckoutControl.tsx')
manifest=source('packages/ui/package.json')
for marker in ['KINDS_WITH_ALL','flex gap-3 justify-center my-6 flex-wrap','OriginalPublishedGallery kind={kindFilter}']:
 if marker not in store:raise SystemExit('STORE_MAIN_MARKUP_MISSING '+marker)
for marker in ['Your Favorites','OriginalPublishedGallery favoritesOnly','text-purple-700']:
 if marker not in fav:raise SystemExit('FAVORITES_MAIN_MARKUP_MISSING '+marker)
for marker in ['Your Cart','Gallery products={products}','projectOriginalCartItems','useStoreCart','StripeTestCheckoutControl','onRemoveCartVariant']:
 if marker not in cart:raise SystemExit('CART_MAIN_MARKUP_MISSING '+marker)
for marker in ['grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mt-8','rounded-2xl border border-neutral-200 bg-white/80','aspect-[4/5]','canonicalSlug','originalGalleryMoney','onRemoveCartVariant']:
 if marker not in gallery:raise SystemExit('GALLERY_MAIN_MARKUP_MISSING '+marker)
for marker in ['fetchPublishedStore','fetchPublishedListings','listStoreFavorites','Gallery products={products}','result.store.id!==context.store.id']:
 if marker not in original:raise SystemExit('PUBLISHED_GALLERY_SCOPE_MISSING '+marker)
for marker in ['priceMinor','line.unitPriceMinor','catalogMediaPath','originalGalleryMoney','canonicalSlug']:
 if marker not in adapter:raise SystemExit('ADAPTER_SCOPE_MISSING '+marker)
for marker in ['ProductImageGallery','CanonicalArtInfoModel','fetchPublishedListing','catalogMediaPath']:
 if marker not in product:raise SystemExit('PRODUCT_SCOPE_MISSING '+marker)
for marker in ['AnimatePresence','FormatSelector','visibleVariants','selected.id','addStoreVariant','setStoreVariantQuantity']:
 if marker not in panel:raise SystemExit('PRODUCT_CONTROLS_MISSING '+marker)
for marker in ['checkout/test','theme==="original-ziledigital"','allDigital']:
 if marker not in checkout:raise SystemExit('CHECKOUT_GUARD_MISSING '+marker)
for marker in ['"./components/storefront/OriginalPublishedGallery"','"./components/cart/StripeTestCheckoutControl"']:
 if marker not in manifest:raise SystemExit('UI_EXPORT_MISSING '+marker)
for rel,body in [('store',store),('favorites',fav),('cart',cart),('bridge',original),('product',product)]:
 for old in ['/api/private/cart','/api/private/checkout','/api/user/favorite','fetchProducts','computeFinalUnitPrice','/api/public/products']:
  if old in body:raise SystemExit('RETIRED_ENDPOINT_USED '+rel+' '+old)
for banned in ['/api/private/','/api/user/','handleCheckout({','stripe.redirectToCheckout']:
 if banned in panel:raise SystemExit('UNTRUSTED_PURCHASE_IN_PANEL '+banned)
print('ZILEDIGITAL_V38A_MAIN_UI_BRIDGE_PASS')
