#!/usr/bin/env python3
"""v38B.2 source/regression guard for authenticated Merchant media uploads.

Accept multipart only on POST /api/merchant/organizations/:org/products/:product/media.
The request must still pass the existing signed session + same-origin middleware;
media route independently enforces merchant permissions, size, and byte sniffing.
"""
import argparse, re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);args=p.parse_args()
root=Path(args.repo).resolve(strict=True)
source=(root/'apps/admin/src/middleware.ts').read_text()
media=(root/'apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/route.ts').read_text()
seed=(root/'apps/admin/src/components/merchant/DemoCatalogSeeder.tsx').read_text()
checks={
    'signed admin-session merchant gate': 'const token = await getToken({' in source and 'if (!token)' in source and 'token.isEmergencyAdmin === true' in source,
    'same-origin required before MIME check': source.index('if (!origin || origin !== expectedOrigin)') < source.index('const contentType = req.headers.get("content-type")'),
    'JSON required by default': 'if (!contentType.startsWith("application/json") && !multipartMediaUpload)' in source and 'error: "JSON required"' in source,
    'multipart narrowly limited to POST': 'const multipartMediaUpload = req.method === "POST" &&' in source,
    'exact path restricted to merchant product media': r'/^\/api\/merchant\/organizations\/[^/]+\/products\/[^/]+\/media$/.test(path)' in source,
    'multipart boundary required': 'contentType.startsWith("multipart/form-data;")' in source and 'boundary=' in source,
    'handler independently requires origin and merchant session': 'checkOrigin(req);' in media and 'await requireMerchantPrincipal()' in media,
    'handler authorizes tenant and media kind': 'addMerchantMedia({' in media and 'organizationId, productId, kind, file' in media and 'kind !== "preview" && kind !== "digital"' in media,
    'handler accepts real multipart': 'await req.formData()' in media and 'file instanceof File' in media,
    'seed sends actual multipart': 'const form = new FormData()' in seed and 'body: form' in seed and 'credentials: "same-origin"' in seed,
}
# Assert request-shape invariants for both positive and negative cases.
route=re.compile(r'^/api/merchant/organizations/[^/]+/products/[^/]+/media$')
boundary=re.compile(r'(?:^|;)\s*boundary=(?:"[^"]+"|[^\s;\"]+)\s*(?:;|$)')
def permitted(method, path, content_type):
    t=content_type.lower()
    return t.startswith('application/json') or (
      method=='POST' and bool(route.fullmatch(path)) and
      t.startswith('multipart/form-data;') and bool(boundary.search(t)))
valid_path='/api/merchant/organizations/abc123/products/p456/media'
checks['valid browser multipart POST admitted']=permitted('POST',valid_path,'multipart/form-data; boundary=----WebKitFormBoundary123')
checks['valid JSON still admitted']=permitted('PATCH',valid_path,'application/json; charset=utf-8')
checks['form-data not admitted on other merchant routes']=not permitted('POST','/api/merchant/organizations/abc123/inventory/adjustments','multipart/form-data; boundary=abc')
checks['form-data not admitted on nested digital route']=not permitted('POST',valid_path+'/delete','multipart/form-data; boundary=abc')
checks['form-data cannot use PATCH/DELETE']=not any(permitted(m,valid_path,'multipart/form-data; boundary=abc') for m in ('PATCH','PUT','DELETE'))
checks['missing boundary not admitted']=not permitted('POST',valid_path,'multipart/form-data')
checks['malformed boundary not admitted']=not permitted('POST',valid_path,'multipart/form-data; boundary=')
for name,ok in checks.items():print(('PASS ' if ok else 'FAIL ')+name)
if not all(checks.values()):raise SystemExit('ZILEDIGITAL_V38B2_MERCHANT_MULTIPART_GUARD_FAIL')
print('ZILEDIGITAL_V38B2_MERCHANT_MULTIPART_GUARD_PASS')
