#!/usr/bin/env python3
"""Read-only architecture audit: storefronts may present commerce, but may not implement it.

Usage: python3 scripts/architecture/audit-commerce-boundaries.py --repo . [--strict]
Never changes files, fetches credentials, or calls payment providers.
"""
import argparse, re, pathlib, sys, json
p=argparse.ArgumentParser()
p.add_argument('--repo', default='.')
p.add_argument('--strict', action='store_true', help='exit nonzero while any violation remains')
p.add_argument('--json', action='store_true', help='machine-readable report')
a=p.parse_args()
repo=pathlib.Path(a.repo).resolve()
apps=('ziledigital','jeanyvesart')
issues=[]
def issue(app,code,rel,details):
 issues.append({'app':app,'code':code,'path':rel,'details':details})
# New scoped API adapters are the only intended app-owned commerce HTTP surface.
methods={
 'cart/route.ts':'GET, POST, PUT',
 'favorites/route.ts':'GET, POST, DELETE',
 'checkout/preflight/route.ts':'GET, POST',
 'checkout/test/route.ts':'GET, POST',
 'guest-claims/request/route.ts':'POST',
 'guest-claims/redeem/route.ts':'POST',
 'my-digital-purchases/route.ts':'GET',
 'orders/route.ts':'GET',
 'orders/[orderId]/route.ts':'GET',
 'orders/by-session/route.ts':'GET',
 'downloads/[grantId]/route.ts':'POST',
 'studio-products/[slug]/route.ts':'GET',
 'media/[assetId]/route.ts':'GET',
 'products/route.ts':'GET',
 'products/[slug]/route.ts':'GET',
}
old_roots={
 'cart','checkout','private','orders','products','downloads','designs','favorite',
 'billing','webhooks','payments','user',
}
backend_model=re.compile(r'\bprisma\.(?:product|cart|cartItem|order|orderItem|payment|paymentAttempt|checkoutAttempt|stockHold|inventoryLevel|digitalGrant|customer|digitalFile|store|organization)\b')
unsafe_import=re.compile(r"""(?:from\s*["'](?:@prisma/client|@acme/db(?:/[^"']*)?|@acme/core/lib/prisma|@acme/core/lib/(?:cart-service|checkout-transaction|payment-handoff|stripe-payment-ledger|digital-entitlements)|@acme/server/(?:cart|billing|payments)/[^"']+)["']|\bnew\s+(?:Stripe|PrismaClient)\s*\()""")
ref_import=re.compile(r"""(?:from|import\s*\()\s*["'](@acme/(?:server|core)/[^"']+)["']""")
legacy_client_call=re.compile(r'/api/(?:private/|user/(?:orders|products|favorite|dashboard)|public/products|cart(?:/|\b)|checkout(?:/|\b)|downloads(?:/|\b)|products(?:/|\b))')
# Scan the actual repo, including paths absent from previous uploaded archives.
for app in apps:
 root=repo/'apps'/app/'src'
 if not root.is_dir():
  issue(app,'APP_NOT_FOUND',str(root), 'Expected storefront source directory missing')
  continue
 for f in sorted(root.rglob('*')):
  if f.suffix not in ('.ts','.tsx','.js','.jsx','.mjs') or f.name.endswith('.d.ts') or not f.is_file(): continue
  if any(x in f.parts for x in ('node_modules','__tests__','.next','dist')):continue
  rel=f.relative_to(repo).as_posix()
  content=f.read_text(errors='replace')
  api_root=root/'app'/'api'
  if f.is_relative_to(api_root) and f.name in ('route.ts','route.js'):
   api=f.relative_to(api_root).as_posix()
   pieces=api.split('/')
   scoped_prefix='public/stores/[storeId]/'
   if api.startswith(scoped_prefix):
    suffix=api[len(scoped_prefix):]
    want=methods.get(suffix)
    if want is None:
     issue(app,'UNKNOWN_SCOPED_ROUTE',rel,'Not in canonical shared commerce route inventory')
    else:
     module=f'@acme/server/api/public/stores/[storeId]/{suffix.removesuffix(".ts").removesuffix(".js")}'; module=module[:-len('/route')]+'/route'
     expected=f'export {{ {want} }} from "{module}";'
     if expected not in content:
      issue(app,'NOT_A_THIN_ADAPTER',rel,'Expected only shared handler exports: '+expected)
     # Next.js requires literal segment metadata in the route file.
     if 'export const runtime = "nodejs";' not in content or 'export const dynamic = "force-dynamic";' not in content:
      issue(app,'MISSING_STATIC_NEXT_CONFIG',rel,'Declare runtime and dynamic as literal exports')
     prohibited_lines=[l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('export const runtime = ') and not l.strip().startswith('export const dynamic = ') and not l.strip().startswith('export { ')]
     if prohibited_lines:
      issue(app,'APP_OWNS_HANDLER_LOGIC',rel,'Scoped routes must contain only literal config and shared re-exports')
   elif api=='public/store-context/route.ts':
    module='@acme/server/api/public/store-context/route'
    if f'export {{ GET }} from "{module}";' not in content:
     issue(app,'NOT_A_THIN_ADAPTER',rel,'Store context must delegate to shared handler')
    if 'export const runtime = "nodejs";' not in content or 'export const dynamic = "force-dynamic";' not in content:
     issue(app,'MISSING_STATIC_NEXT_CONFIG',rel,'Store context requires static Next config')
   elif pieces[0] in old_roots or (pieces[0]=='public' and len(pieces)>1 and pieces[1] in ('products','checkout','cart','downloads')):
    issue(app,'LEGACY_COMMERCE_ENDPOINT',rel,'Retire only after migrating UI callers to /api/public/stores/[storeId]/...')
   elif api in ('auth/clear/route.ts','auth/login/route.ts','auth/forgot/route.ts'):
    issue(app,'RETIRED_AUTH_ENDPOINT',rel,'Old authentication handler may import removed server code; replace or remove explicitly')
  if not f.is_relative_to(api_root) and legacy_client_call.search(content):
   issue(app,'LEGACY_COMMERCE_CLIENT_CALL',rel,'UI still calls a retired non-scoped endpoint')
  if backend_model.search(content) or unsafe_import.search(content):
   issue(app,'APP_LOCAL_BUSINESS_LOGIC',rel,'Direct database/commerce provider access; move server-side logic to shared packages')
  # Catch imports of retired shared code, not just route patterns.
  for match in ref_import.finditer(content):
   mod=match.group(1)
   package,sub=mod.split('/',1)[0],mod.split('/',1)[1]
   # @acme/server/api/foo maps to packages/server/src/api/foo.ts, and so on.
   namespace=mod.split('/')[0]+'/' + mod.split('/')[1]
   rootname=mod.split('/')[1]
   subpath='/'.join(mod.split('/')[2:])
   srcroot=repo/'packages'/rootname/'src'/subpath
   if not srcroot.with_suffix('.ts').is_file() and not srcroot.with_suffix('.tsx').is_file() and not (srcroot/'index.ts').is_file():
    issue(app,'MISSING_SHARED_TARGET',rel,mod)
# Admin must also migrate away from its obsolete global product API; it already
# has canonical organization-scoped merchant product endpoints.
admin_api=repo/'apps'/'admin'/'src'/'app'/'api'/'admin'/'products'
if admin_api.is_dir():
 for f in sorted(admin_api.rglob('route.ts')):
  issue('admin','ADMIN_LEGACY_PRODUCT_ROUTE',f.relative_to(repo).as_posix(),
        'Migrate admin UI to /api/merchant/organizations/[organizationId]/... before retiring')
issues.sort(key=lambda x:(x['app'],x['path'],x['code']))
if a.json:
 print(json.dumps({'violations':len(issues),'issues':issues},indent=2))
else:
 for item in issues:
  print(f"{item['code']}: {item['path']}  [{item['details']}]")
 print(f'ZILEDIGITAL_COMMERCE_BOUNDARY_AUDIT: {len(issues)} violation(s)')
 if issues: print('No files were deleted or modified. Do not restore removed legacy services.')
sys.exit(1 if a.strict and issues else 0)
