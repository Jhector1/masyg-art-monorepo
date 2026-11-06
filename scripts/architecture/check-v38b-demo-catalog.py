#!/usr/bin/env python3
"""No-network static safety guard for the local-only demonstration catalog UI."""
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--repo', required=True)
args = parser.parse_args()
root = Path(args.repo).resolve()
page = (root / 'apps/admin/src/app/merchant/demo-catalog/page.tsx').read_text()
client = (root / 'apps/admin/src/components/merchant/DemoCatalogSeeder.tsx').read_text()
products = (root / 'apps/admin/src/app/merchant/products/page.tsx').read_text()
checks = {
    'development only route': 'process.env.NODE_ENV !== "development"' in page and 'notFound()' in page,
    'strict expected local dev database': all(x in page for x in ['haitian_art_store', 'ziledigital', 'DATABASE_URL', 'localhost', '127.0.0.1', 'current_database()', 'current_schema()']),
    'authorised merchant workspace': 'merchantWorkspace(searchParams)' in page and 'store.role === "OWNER" || store.role === "ADMIN"' in page,
    'server/client boundary': 'import { StoreSelect } from "@/components/merchant/shared"' in page and 'mutatable(store)' not in page and 'const canSeed' in page,
    'tenant-scope reads': 'organizationId: store.organizationId' in page and 'storeId: store.storeId' in page,
    'seed gating uses server-authorized role': 'verified && canSeed' in page and '{verified && !canSeed' in page and '{verified && canSeed' in page,
    'no client database access': 'prisma.' not in client and 'DATABASE_URL' not in client,
    'same-origin authenticated merchant requests': client.count('credentials: "same-origin"') >= 2,
    'canonical create / media / publication / inventory calls': all(x in client for x in ['/products`, "POST"', '/media`', '/inventory/adjustments`, "POST"', '/products/${product.id}`, "POST"', 'status: "PUBLISHED"']),
    'private digital file upload': '"digital", variant.id' in client and 'new File([demoSvg(spec)]' in client,
    'generated public png previews': 'canvas.toBlob(' in client and '"preview")' in client,
    'reuse existing fixtures and refuse collisions': all(x in client for x in ['known.get(spec.slug)', 'listing.product.title !== spec.title', 'digitalFiles.length === 0', 'product.media.length', 'held < variantSpec.stock!']),
    'unavailable physical fixture remains zero stock': 'slug: `${ROOT}sold-out`' in client and 'stock: 0' in client,
    'mixed and digital products': client.count('fulfillment: "DIGITAL"') >= 3 and client.count('fulfillment: "PHYSICAL"') >= 4,
    '7 distinct stable fixtures': client.count('slug: `${ROOT}') == 7,
    'merchant product link dev-only': 'process.env.NODE_ENV === "development"' in products and '/merchant/demo-catalog' in products,
    'no unsafe route/backdoor API': all(x not in (page + client) for x in ['/api/private/cart', '/api/private/checkout', 'unsafe', 'executeRaw', 'CREATE TABLE', 'DROP TABLE']),
}
failed = [name for name, ok in checks.items() if not ok]
for name, okay in checks.items():
    print(('PASS ' if okay else 'FAIL ') + name)
if failed:
    raise SystemExit('ZILEDIGITAL_V38B_DEMO_CATALOG_GUARD_FAIL')
print('ZILEDIGITAL_V38B_DEMO_CATALOG_GUARD_PASS')
