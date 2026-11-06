#!/usr/bin/env python3
"""v38H: strict license tiers, fixed editions remain visible, no client-priced add-ons."""
from pathlib import Path
import argparse,subprocess
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);a=p.parse_args();r=Path(a.repo)
checks={
'packages/core/src/lib/digital-license-policy.ts':['duplicateLicenseTier','kinds.size === digital.length','licenseOf(attributes) !== null'],
'packages/core/src/lib/catalog-contract.ts':['duplicateLicenseTier(previous','Only one edition per license tier'],
'packages/core/src/lib/catalog-lifecycle.ts':['duplicateLicenseTier(siblings','duplicateLicenseTier(existing','isolationLevel:"Serializable"','requireMerchantAccess'],
'packages/core/src/lib/public-catalog.ts':['(!license || isLicensed)','physicalOptionsAllowed(listing.product'],
'packages/core/src/lib/physical-options.ts':['return true;','fulfillment !== "PHYSICAL"','physicalOptionsReady'],
'packages/core/src/lib/cart-contract.ts':['licenseAllowed','physicalOptionsAllowed','FILE_UNAVAILABLE'],
'packages/core/src/lib/checkout-transaction.ts':['assessVariant','attributesSnapshot: v.attributes'],
'apps/admin/src/components/merchant/ProductEditor.tsx':['duplicateLicenseTier(digital,newLicense)','duplicatedTiers','digitalEligibleForStore','MerchantMediaStudio'],
'apps/ziledigital/src/components/CanonicalArtInfoModel.tsx':['Included license:','product.product.offersDigitalLicenses','addStoreVariant(product.store.id,selected.id,1)'],
'apps/admin/src/components/MerchantMediaStudio.tsx':['new FormData()','HTTP ${res.status}','Check the Admin server','Select private files for the chosen digital edition'],
}
for rel,need in checks.items():
 s=(r/rel).read_text()
 for term in need:
  if term not in s:raise SystemExit('V38H_GUARD_FAIL '+rel+' '+term)
if '/api/private/cart' in (r/'apps/ziledigital/src/components/CanonicalArtInfoModel.tsx').read_text():raise SystemExit('LEGACY_CART_REFUSED')
assert (r/'packages/core/src/lib/catalog-lifecycle.ts').read_text().count('isolationLevel:"Serializable"')==2
cmd=['tsc','--strict','--noEmit','--target','es2020','--skipLibCheck','--noResolve',str(r/'packages/core/src/lib/digital-license-policy.ts'),str(r/'packages/core/src/lib/physical-options.ts')]
proc=subprocess.run(cmd,capture_output=True,text=True,timeout=40)
if proc.returncode:raise SystemExit('PURE_HELPER_TSC_FAILED\n'+proc.stdout+proc.stderr)
print('ZILEDIGITAL_V38H_FIXED_EDITION_GUARD_PASS')
