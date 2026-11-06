#!/usr/bin/env python3
"""v38F: deny client-priced options and preserve merchant/product/tenant scoping."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);args=p.parse_args();root=Path(args.repo)
def read(name):
 path=root/name
 assert path.is_file(),name
 return path.read_text()
def check(name,all_of):
 s=read(name)
 for term in all_of:assert term in s,(name,term)
 print('PASS',name)
check('packages/db/prisma/schema.prisma',['offersFraming Boolean @default(false)','offersGlazing Boolean @default(false)'])
check('packages/db/prisma/migrations/0009_product_physical_option_opt_in/migration.sql',['ALTER TABLE "ziledigital"."Product"','DEFAULT false'])
check('packages/core/src/lib/catalog-contract.ts',['frame: z.string()','glazing: z.string()','physicalOptionsReady','offersFraming: z.boolean()','offersGlazing: z.boolean()'])
check('packages/core/src/lib/physical-options.ts',['physicalOptionsAllowed','physicalOptionsReady','FRAME_CHOICES','GLAZING_CHOICES'])
check('packages/core/src/lib/catalog-lifecycle.ts',['requireMerchantAccess','physicalOptionsAllowed','physicalOptionsReady','normalizedOption'])
check('packages/core/src/lib/public-catalog.ts',['physicalOptionsAllowed(listing.product','offersFraming:true','offersGlazing:true'])
check('packages/core/src/lib/cart-contract.ts',['physicalOptionsAllowed(variant.product','PHYSICAL_OPTION_NOT_OFFERED','selection:publicSelection(variant.attributes)'])
check('packages/core/src/lib/cart-service.ts',['offersFraming:true','offersGlazing:true','assessVariant'])
check('packages/core/src/lib/checkout-transaction.ts',['offersFraming:true','offersGlazing:true','assessVariant','attributesSnapshot: v.attributes'])
check('packages/core/src/lib/physical-variant-selection.ts',['selectPhysicalVariant','PHYSICAL_KEYS','v.available'])
check('apps/admin/src/components/merchant/ProductCreate.tsx',['Offer frame choices','Offer protective glazing','offersFraming, offersGlazing'])
check('apps/admin/src/components/merchant/ProductEditor.tsx',['Save print option settings','Add inactive physical edition','FRAME_CHOICES','GLAZING_CHOICES','Readiness:'])
check('apps/admin/src/lib/merchant-workspace.ts',['offersFraming:true','offersGlazing:true'])
check('apps/ziledigital/src/components/CanonicalArtInfoModel.tsx',['selectPhysicalVariant','physicalDimensionChoices','showGlazingSelector','addStoreVariant(product.store.id,selected.id,1)'])
check('packages/ui/src/components/product/shared/core/PrintCustomizerCore.tsx',['Visual simulation only','showGlazingSelector','glazingOptions','showFrameSelector'])
assert '/api/private/cart' not in read('apps/ziledigital/src/components/CanonicalArtInfoModel.tsx')
assert 'calculateFramePrice' not in read('apps/ziledigital/src/components/CanonicalArtInfoModel.tsx')
print('ZILEDIGITAL_V38F_PHYSICAL_OPTIONS_GUARD_PASS')
