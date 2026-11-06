#!/usr/bin/env python3
"""Static contract checks for v27: UI must remain on scoped canonical merchant APIs."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
console = (root / 'apps/admin/src/components/MerchantCatalogConsole.tsx').read_text()
frame = (root / 'apps/admin/src/components/ClientFrame.tsx').read_text()
header = (root / 'apps/admin/src/components/Header.tsx').read_text()
page = (root / 'apps/admin/src/app/merchant/page.tsx').read_text()
variant = (root / 'apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/variants/[variantId]/route.ts').read_text()

required = {
  'merchant API only': '/api/merchant/organizations/' in console and '/api/admin/' not in console,
  'no direct database from browser': 'prisma.' not in console and 'passwordHash' not in console,
  'store ownership comes from session': 'requireMerchantPrincipal' in page,
  'selected store scoped': 'workspace.organizationId' in console and 'workspace.storeId' in console,
  'editor uses canonical product PATCH': '"PATCH", { title: title.trim(), description }' in console,
  'variant update uses canonical core': 'updateCatalogVariant' in variant and 'requireMerchantPrincipal' in variant and 'variantPatchInput.parse' in variant,
  'variant endpoint has no global admin bypass': 'isAdmin' not in variant and 'isEmergencyAdmin' not in variant,
  'store publication preserved': 'Publish storefront' in console and 'Unpublish storefront' in console,
  'product create includes variants': 'Create draft product' in console and 'variantPayload' in console,
  'media upload not falsely activated': '/api/products/upload' not in console and '/api/admin/products/' not in console,
  'responsive navigation': 'merchantLinks' in frame and 'sidebarOpen' in frame,
  'header separates merchant mode': 'showSearch={!merchantMode}' in frame and 'showSearch?: boolean' in header,
  'product count explicitly bounded': 'latest 50 listings' in console,
}
for label, good in required.items():
    if not good:
        print('FAIL', label, file=sys.stderr)
if not all(required.values()):
    raise SystemExit(1)
print('ZILEDIGITAL_V27_STATIC_PASS')
