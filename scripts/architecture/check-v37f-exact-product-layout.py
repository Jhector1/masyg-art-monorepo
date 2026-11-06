#!/usr/bin/env python3
"""Source-exact ZileDigital product visual composition, canonical-only fulfillment."""
import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);r=Path(p.parse_args().repo)
client=(r/'apps/ziledigital/src/app/(pages)/(public)/store/[id]/ProductClient.tsx').read_text()
panel=(r/'apps/ziledigital/src/components/CanonicalArtInfoModel.tsx').read_text()
original_gallery=(r/'packages/ui/src/components/product/detail/ProductImageGallery.tsx').read_text()
options=(r/'packages/ui/src/components/product/shared/core/PurchaseOptionsCore.tsx').read_text()
for old in ['max-w-7xl mx-auto pt-10 lg:pt-16','grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start','ProductImageGallery','CanonicalArtInfoModel']:
 assert old in client,old
for old in ['flex relative flex-col gap-6 w-full','DescriptionCard','SaleAndCountdown','PurchaseOptionsCore','CartActions','SizeSelectorCore','LicenseSelectorCore','PrintCustomizerCore']:
 assert old in panel,old
for old in ['ProductImagePreviews','ProductImage','ImageSlider']:
 assert old in original_gallery,old
for bound in ['fetchPublishedStore','fetchPublishedListing','catalogMediaPath']:
 assert bound in client,bound
for bound in ['visibleVariants','addStoreVariant','setStoreVariantQuantity','getStoreCart','selected.id','showBundleDiscount={false}']:
 assert bound in panel,bound
for forbidden in ['/api/private/','/api/user/','useProductData','computeFinalUnitPrice','ProductConfigurator','window.location.href','stripe.redirectToCheckout','customSize.width']:
 assert forbidden not in panel,forbidden
assert 'currency' in options and 'showBundleDiscount' in options
print('ZILEDIGITAL_V37F_ORIGINAL_PRODUCT_UI_GUARD_PASS')
