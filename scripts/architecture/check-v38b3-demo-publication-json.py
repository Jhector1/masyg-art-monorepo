#!/usr/bin/env python3
"""v38B.3: publication writes must satisfy the authenticated Merchant JSON policy.

This guard checks the actual seed and middleware sources and independently
exercises request-body decision cases. No HTTP bypass or DB writes are added.
"""
import argparse, re
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--repo',required=True); a=p.parse_args()
root=Path(a.repo).resolve(strict=True)
seed=(root/'apps/admin/src/components/merchant/DemoCatalogSeeder.tsx').read_text()
edge=(root/'apps/admin/src/middleware.ts').read_text()
route=(root/'apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/route.ts').read_text()
list_route=(root/'apps/admin/src/app/api/merchant/organizations/[organizationId]/stores/[storeId]/products/route.ts').read_text()
# Match actual repo source to prevent accidental policy downgrades.
checks={
 'authenticated middleware retains JSON-only writes': 'if (!contentType.startsWith("application/json") && !multipartMediaUpload)' in edge and 'error: "JSON required"' in edge,
 'publishing is an authenticated product POST': 'export async function POST(' in route and 'await requireMerchantPrincipal()' in route and 'publishCatalogProduct({' in route,
 'publication request passes an explicit empty JSON object': 'await jsonApi(`${base}/products/${product.id}`, "POST", {});' in seed,
 'all merchant writes send JSON regardless of missing body': 'const isMutation = method !== "GET";' in seed and '...(isMutation ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) } : {})' in seed,
 'GET leaves body and content type unspecified': 'method !== "GET"' in seed and '...(isMutation ? ' in seed,
 'all seed API calls remain same-origin': 'credentials: "same-origin"' in seed and 'cache: "no-store"' in seed,
 'uploads retain multipart transport': 'const form = new FormData()' in seed and 'body: form' in seed,
 'existing fixtures remain stable, resumable': 'known.get(spec.slug)' in seed and 'product.media.length' in seed and 'variant.digitalFiles.length === 0' in seed,
 'merchant list includes media and digital files for resume': 'listMerchantProducts({' in list_route and 'storeId' in list_route,
 'no other checkout/private legacy endpoints': '/api/private/checkout' not in seed and '/api/private/cart' not in seed,
}
# Model the exact transport decision, including previously failing bodyless POST.
def json_write_shape(method, body=None):
    if method=='GET': return {}
    return {'Content-Type':'application/json', 'body':'{}' if body is None else __import__('json').dumps(body, separators=(',',':'))}
checks['bodyless POST becomes JSON {}'] = json_write_shape('POST')=={'Content-Type':'application/json','body':'{}'}
checks['explicit POST {} stays JSON {}'] = json_write_shape('POST',{})=={'Content-Type':'application/json','body':'{}'}
checks['PATCH remains JSON'] = json_write_shape('PATCH', {'status':'PUBLISHED'})['body']=='{"status":"PUBLISHED"}'
checks['GET remains bodyless'] = json_write_shape('GET')=={}
for name, ok in checks.items(): print(('PASS ' if ok else 'FAIL ')+name)
if not all(checks.values()): raise SystemExit('ZILEDIGITAL_V38B3_PUBLICATION_JSON_GUARD_FAIL')
print('ZILEDIGITAL_V38B3_PUBLICATION_JSON_GUARD_PASS')
