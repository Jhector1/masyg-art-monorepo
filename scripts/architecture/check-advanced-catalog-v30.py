#!/usr/bin/env python3
"""Validate v30 contracts and tenant authorization boundaries statically (no DB access)."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[2]
assert (root/'packages/db/prisma/migrations/0001_initial/migration.sql').exists()
sql=(root/'packages/db/prisma/migrations/0002_catalog_categories_inventory_pricing/migration.sql').read_text()
assert 'ALTER TABLE "ziledigital"."ProductVariant"' in sql
assert 'ADD COLUMN "compareAtMinor" INTEGER' in sql
assert 'CHECK ("compareAtMinor" IS NULL OR "compareAtMinor" > "priceMinor")' in sql
assert not re.search(r'\b(?:DROP|TRUNCATE|DELETE)\b',sql,re.I)
schema=(root/'packages/db/prisma/schema.prisma').read_text()
assert 'compareAtMinor Int?' in schema
for name in ['Category','ProductCategory','InventoryLocation','InventoryLevel','MerchantAuditLog']:
 assert f'model {name} ' in schema
for sub in ['categories','inventory']:
 s=(root/f'apps/admin/src/app/merchant/{sub}/page.tsx').read_text()
 assert 'merchantWorkspace(searchParams)' in s and 'dynamic = "force-dynamic"' in s
for sub in ['categories/route.ts','categories/[categoryId]/route.ts','products/[productId]/categories/route.ts','inventory/locations/route.ts','inventory/adjustments/route.ts']:
 s=(root/'apps/admin/src/app/api/merchant/organizations/[organizationId]'/sub).read_text()
 assert 'requireMerchantPrincipal()' in s and 'origin' in s and 'merchantHttpError' in s,sub
 assert 'prisma.' not in s,sub
for sub in ['merchant-categories','merchant-inventory']:
 s=(root/f'packages/core/src/lib/{sub}.ts').read_text()
 assert 'requireMerchantAccess' in s and 'organizationId: scope.organizationId' in s and 'merchantAuditLog' in s
stock=(root/'packages/core/src/lib/merchant-inventory.ts').read_text()
for t in ['isolationLevel: "Serializable"','"TRACKED"','reserved','inventory.stock.adjusted']:
 assert t in stock
assert 'reserved: { increment' not in stock
assert 'Prisma.TransactionIsolationLevel' not in stock
editor=(root/'apps/admin/src/components/merchant/ProductEditor.tsx').read_text()
for s in ['Save categories','Regular price','edition','finish','MerchantMediaStudio']:
 assert s in editor
nav=(root/'apps/admin/src/components/ClientFrame.tsx').read_text()
assert '/merchant/categories' in nav and '/merchant/inventory' in nav
spec=json.loads((root/'contracts/openapi/commerce-public-v1.json').read_text())
props=spec['components']['schemas']['Variant']['properties']
assert 'compareAtMinor' in props and 'priceMinor' in props
assert 'storageKey' not in str(spec)
public=(root/'packages/core/src/lib/public-catalog.ts').read_text()
assert 'compareAtMinor: variant.compareAtMinor' in public
print('ZILEDIGITAL_V30_ARCHITECTURE_PASS')
