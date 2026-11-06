#!/usr/bin/env python3
"""Read-only v36A buyer identity, original visual adapter and published commerce boundary guard."""
from pathlib import Path
import subprocess, sys, json
root=Path(__file__).resolve().parents[2]
required={
 'packages/db/prisma/schema.prisma':['model StoreFavorite','@@id([organizationId, storeId, userId, productId])','savedFavorites StoreFavorite[]'],
 'packages/db/prisma/migrations/0006_store_favorites/migration.sql':['"StoreFavorite"','FOREIGN KEY ("organizationId", "storeId", "productId")','"StoreListing"'],
 'packages/core/src/lib/store-favorites.ts':['resolvePublishedStore','listPublicProductsByIds','organizationId:s.organizationId','userId:s.user','status:"PUBLISHED"','storeFavorite.upsert'],
 'packages/core/src/lib/public-catalog.ts':['listPublicProductsByIds','organizationId: store.organizationId','status:"PUBLISHED"'],
 'packages/server/src/api/public/stores/[storeId]/favorites/route.ts':['getServerSession','resolvePublicStoreFromHostHeader','verified.id!==storeId','Invalid origin','setBuyerStoreFavorite'],
 'packages/core/src/contexts/FavoriteContext.tsx':['getCurrentStorefront','listStoreFavorites','setStoreFavorite'],
 'packages/core/src/hooks/useUserOrders.ts':['getCurrentStorefront','listStoreOrders','ordersToCollection','["PAID","FULFILLING","FULFILLED"]'],
 'packages/core/src/lib/customer-orders.ts':['customer:{is:{userId:args.userId}}','asset:{private:false}'],
 'apps/jeanyvesart/src/app/page.tsx':['OriginalCatalogGrid','Featured originals','Jean&nbsp;Yves'],
 'apps/jeanyvesart/src/app/store/page.tsx':['OriginalCatalogGrid','One of one'],
 'apps/jeanyvesart/src/components/store/painting/OriginalArtworkDetails.tsx':['fetchPublishedListing','isPublicOriginal','variantId:original.id','quantity:1'],
 'apps/ziledigital/src/app/(pages)/(public)/store/StoreClient.tsx':['PublishedGallery','aria-pressed','router.replace'],
 'packages/ui/src/components/storefront/PublishedGallery.tsx':['fetchPublishedStore','listStoreFavorites','formatCatalogPrice','toggleFavorite'],
}
for rel,required_tokens in required.items():
 p=root/rel
 if not p.is_file():sys.exit('V36A_MISSING '+rel)
 content=p.read_text()
 for token in required_tokens:
  if token not in content:sys.exit('V36A_BOUNDARY_FAILED '+rel+' '+token)
for app in ('jeanyvesart','ziledigital'):
 path=root/f'apps/{app}/src/app/api/public/stores/[storeId]/favorites/route.ts'
 contents=path.read_text()
 for token in ('export const runtime = "nodejs";','export const dynamic = "force-dynamic";','export { GET, POST, DELETE } from "@acme/server/api/public/stores/[storeId]/favorites/route";'):
  if token not in contents:sys.exit('V36A_NONCANONICAL_ROUTE '+app)
for rel in ('packages/core/src/contexts/FavoriteContext.tsx','packages/core/src/hooks/useUserOrders.ts'):
 content=(root/rel).read_text()
 if '/api/user/favorite' in content or '/api/user/orders' in content or 'userId=${' in content:
  sys.exit('V36A_LEGACY_BUYER_CALL '+rel)
proc=subprocess.run([sys.executable,str(root/'scripts/architecture/audit-commerce-boundaries.py'),'--repo',str(root),'--json'],capture_output=True,text=True)
if proc.returncode:sys.exit(proc.stderr)
violations=json.loads(proc.stdout)['violations']
if violations!=0:sys.exit('V36A_COMMERCE_FINDINGS '+str(violations))
print('ZILEDIGITAL_V36A_BUYER_UI_BOUNDARIES_PASS')
