#!/usr/bin/env python3
from pathlib import Path
import sys,subprocess,json,collections
root=Path(__file__).resolve().parents[2]
removed=[
 "apps/ziledigital/src/app/api/public/products/[id]/route.ts",
 "apps/ziledigital/src/app/api/private/checkout/success/route.ts",
 "apps/ziledigital/src/app/api/private/downloads/archive/route.ts",
 "apps/ziledigital/src/app/api/private/downloads/proxy/route.ts",
 "packages/core/src/lib/client/downloads.ts",
]
for rel in removed:
 if (root/rel).exists():sys.exit("OBSOLETE_ENDPOINT_REMAINS "+rel)
required={
 "packages/core/src/lib/buyer-grant-download.ts":["purchasedFiles", "maximumUses", "uses: authorized.uses", "PAID", "customer: { is: { userId } }", "private"],
 "packages/server/src/api/public/stores/[storeId]/downloads/[grantId]/route.ts":["resolvePublicStoreFromHostHeader", "authorizeBuyerGrant", "consumeBuyerGrant", 'redirect:"error"', "MAX_FILE_BYTES", "no-store"],
 "packages/server/src/lib/private-digital-download.ts":["cloudinary:raw:authenticated:", "private_download_url", "api.cloudinary.com"],
 "packages/ui/src/components/store/checkout/CheckoutSuccessPage.tsx":["by-session", "my-digital-purchases", "downloadStoreGrant", "setTick"],
 "packages/core/src/lib/client/storefront-commerce.ts":["downloadStoreGrant", "/downloads/", 'method: "POST"', 'credentials: "same-origin"'],
 "packages/ui/src/components/profile/CollectionGallery.tsx":["listStoreDigitalPurchases", "downloadStoreGrant", "grantsByItem"],
 "packages/core/src/utils/fetchProductById.ts":["getCurrentStorefront", "/studio-products/"],
 "packages/core/src/lib/storefront-studio-product.ts":["getPublicProduct", "studioPurchasingEnabled:false"],
}
for rel,tokens in required.items():
 content=(root/rel).read_text()
 for token in tokens:
  if token not in content:sys.exit("SECURITY_BOUNDARY_MISSING "+rel+" "+token)
# Legacy URL-proxy and old success path must never appear in active browser imports.
for folder in (root/"apps/ziledigital/src", root/"packages/ui/src", root/"packages/core/src"):
 for f in folder.rglob("*.ts*"):
  text=f.read_text(errors="replace")
  if "/api/private/downloads/proxy?url=" in text or "/api/private/checkout/success?" in text:
   sys.exit("UNSAFE_LEGACY_DOWNLOAD_CALLER "+str(f))
cmd=[sys.executable,str(root/"scripts/architecture/audit-commerce-boundaries.py"),"--repo",str(root),"--json"]
result=subprocess.run(cmd,capture_output=True,text=True)
if result.returncode:sys.exit("AUDIT_FAILED "+result.stderr)
issues=json.loads(result.stdout)["issues"]
print("ZILEDIGITAL_V35B_SECURITY_BOUNDARIES_PASS")
print("ZILEDIGITAL_V35B_FINDINGS",len(issues),dict(collections.Counter(f["code"] for f in issues)))
