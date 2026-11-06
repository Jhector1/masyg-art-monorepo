#!/usr/bin/env python3
"""v34D read-only source guard: retire unreferenced legacy components, retain active commerce."""
from pathlib import Path
import collections,subprocess,json,sys
root=Path(__file__).resolve().parents[2]
retired=['apps/jeanyvesart/src/app/api/admin/products/[id]/assets/replace/route.ts', 'apps/jeanyvesart/src/app/api/checkout/apply-edit-credits.ts', 'apps/ziledigital/src/app/api/private/checkout/apply-edit-credits.ts', 'apps/jeanyvesart/src/app/api/products/[id]/route.ts', 'apps/jeanyvesart/src/components/store/painting/OriginalPaintingsDetails.tsx', 'apps/jeanyvesart/src/components/cart/CartPageComponent.tsx', 'apps/jeanyvesart/src/lib/checkout/client.ts', 'apps/jeanyvesart/src/lib/checkout/useCheckout.ts', 'apps/jeanyvesart/src/lib/checkout/useResumeCheckout.ts', 'apps/jeanyvesart/src/lib/checkout/reservation.ts']
for f in retired:
 if (root/f).exists():sys.exit('LEGACY_COMPONENT_PRESENT '+f)
needed={
 'apps/jeanyvesart/src/app/cart/page.tsx':'CanonicalCartView',
 'apps/jeanyvesart/src/app/store/[id]/page.tsx':'OriginalArtworkDetails',
 'apps/jeanyvesart/src/app/store/page.tsx':'OriginalCatalogGrid',
 'apps/jeanyvesart/src/app/cart/checkout/success/CheckoutSuccessClient.tsx':'fetchOrder',
 'apps/ziledigital/src/app/(pages)/(public)/store/[id]/studio/page.tsx':'',
 'apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/media/[assetId]/route.ts':'requireMerchantAccess',
 'apps/ziledigital/src/app/api/auth/reset/route.ts':'export { POST } from "@acme/server/api/auth/reset/route";',
 'packages/server/src/api/auth/reset/route.ts':'Prisma.TransactionIsolationLevel.Serializable',
 'packages/core/src/lib/password-reset-input.ts':'passwordResetInput',
 'packages/core/src/lib/password-reset-input.test.ts':'rejects unknown fields',
}
for f,token in needed.items():
 p=root/f
 if not p.is_file():sys.exit('MISSING_ACTIVE_SOURCE '+f)
 if token not in p.read_text():sys.exit('MISSING_ACTIVE_BOUNDARY '+f+' '+token)
reset=(root/'packages/server/src/api/auth/reset/route.ts').read_text()
for token in ('requireSameOriginJson','verificationToken.deleteMany','passwordHash','id:user.id,email:vt.identifier','expires:{gt:now}','Cache-Control','bcrypt.hash(newPassword, 12)'):
 if token not in reset:sys.exit('RESET_SECURITY_REGRESSION '+token)
# Avoid moving legacy calls into new implementations. The remaining 23 are explicitly unreleased.
audit=subprocess.run([sys.executable,str(root/'scripts/architecture/audit-commerce-boundaries.py'),'--repo',str(root),'--json'],capture_output=True,text=True)
if audit.returncode:sys.exit('AUDIT_FAILED '+audit.stderr)
issues=json.loads(audit.stdout)['issues'];counts=collections.Counter(item['code'] for item in issues)
for code,ceiling in {'APP_LOCAL_BUSINESS_LOGIC':8,'LEGACY_COMMERCE_ENDPOINT':11,'LEGACY_COMMERCE_CLIENT_CALL':4}.items():
 if counts[code]>ceiling:sys.exit('ARCHITECTURE_REGRESSION '+code+f' {counts[code]} > {ceiling}')
print('ZILEDIGITAL_V34D_CLEAN_SLATE_PASS')
print('ZILEDIGITAL_V34D_REMAINING_FINDINGS',len(issues),dict(counts))
