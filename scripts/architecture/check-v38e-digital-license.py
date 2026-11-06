from pathlib import Path
import sys
repo=Path(sys.argv[1]) if len(sys.argv)>1 else Path('.')
def text(p):return (repo/p).read_text()
def required(p,strings):
 s=text(p)
 for piece in strings:
  assert piece in s,(p,piece)
required('packages/core/src/lib/catalog-contract.ts',['license: z.enum(["personal", "commercial", "extended"])','offersDigitalLicenses: z.boolean()','checkLicenseCreation'])
required('packages/core/src/lib/catalog-lifecycle.ts',['requireMerchantAccess','licensedVariantsReady','licenseAllowed','offersDigitalLicenses','active:false'])
required('packages/core/src/lib/cart-contract.ts',['LICENSE_NOT_OFFERED','licenseAllowed'])
required('packages/core/src/lib/cart-service.ts',['attributes:true','offersDigitalLicenses:true','resolvePublishedStore'])
required('packages/core/src/lib/checkout-transaction.ts',['attributesSnapshot: v.attributes','offersDigitalLicenses:true','assessVariant'])
required('apps/admin/src/components/merchant/ProductCreate.tsx',['Offer license choices for digital downloads','offersDigitalLicenses','license:v.license'])
required('apps/admin/src/components/merchant/ProductEditor.tsx',['Offer license choices for digital downloads','License tier','inactive licensed edition'])
required('apps/ziledigital/src/components/CanonicalArtInfoModel.tsx',['product.product.offersDigitalLicenses','LicenseSelectorCore','showFullPrice','selectByAttr("license",license.type)'])
required('packages/core/src/lib/public-catalog.ts',['offersDigitalLicenses:true','listing.product.offersDigitalLicenses'])
required('packages/db/prisma/schema.prisma',['offersDigitalLicenses Boolean @default(false)'])
required('packages/db/prisma/migrations/0008_product_digital_license_opt_in/migration.sql',['ALTER TABLE "ziledigital"."Product"','DEFAULT false'])
route='apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/variants/route.ts'
required(route,['requireMerchantPrincipal','createCatalogVariant','merchantHttpError'])
assert '/api/private/cart' not in text('apps/ziledigital/src/components/CanonicalArtInfoModel.tsx')
print('ZILEDIGITAL_V38E_DIGITAL_LICENSE_GUARD_PASS')
