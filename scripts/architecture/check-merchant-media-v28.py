#!/usr/bin/env python3
"""Static safety contract for canonical merchant media; runtime integration tests are still required."""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
server=(root/'packages/server/src/lib/merchant-cloudinary.ts').read_text()
admin=(root/'apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/route.ts').read_text()
public=(root/'apps/commerce-api/src/app/v1/stores/[storeId]/media/[assetId]/route.ts').read_text()
private=(root/'apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/[assetId]/route.ts').read_text()
client=(root/'apps/admin/src/components/MerchantMediaStudio.tsx').read_text()
tenancy=(root/'packages/core/src/lib/tenancy.ts').read_text()
assert 'requireMerchantAccess' in server and 'capability: "manage"' in server
assert 'type: visibility' in server and '"authenticated"' in server and 'private: args.kind === "digital"' in server
assert 'transformation:' in server and 'PREVIEW' in server and 'crop: "limit"' in server
assert 'detectFileType' in server and 'MAX_PUBLIC_IMAGE_BYTES' in server and 'MAX_DIGITAL_FILE_BYTES' in server
assert 'cloudinary.uploader.destroy' in server
assert 'requireMerchantPrincipal' in admin and 'checkOrigin(req)' in admin and 'req.formData()' in admin
assert 'requireMerchantPrincipal' in private and 'asset: { private: false }' in private
assert 'resolvePublishedStore' in public and 'asset: { private: false }' in public
assert 'status: "PUBLISHED"' in public and 'organizationId: store.organizationId' in public
assert 'storageKey: true' in public and 'NextResponse.json({ asset:' not in public
assert 'Private digital' in client and 'router.refresh()' in client and 'credentials: "same-origin"' in client
assert 'asset: { private: false }' in tenancy and 'digitalFiles:' in tenancy
assert 'storageKey: true' not in tenancy.split('export async function listMerchantProducts')[1].split('export async function')[0]
print('ZILEDIGITAL_MERCHANT_MEDIA_V28_BOUNDARY_PASS')
