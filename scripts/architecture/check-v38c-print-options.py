#!/usr/bin/env python3
"""v38C original print controls + canonical variants regression guard."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);args=p.parse_args()
root=Path(args.repo).resolve()
s=(root/'apps/ziledigital/src/components/CanonicalArtInfoModel.tsx').read_text()
checks={
  'original size control': 'SizeSelectorCore' in s and 'selectedIsPhysical&&<motion.div' in s,
  'original material-frame preview': 'PrintCustomizerCore' in s and 'currentMaterial' in s and 'showGlazingSelector' in s,
  'merchant material labels': 'physical.map(v=>attr(v,"material"))' in s and 'publishedMaterial' in s,
  'merchant frame labels': 'physicalDimensionChoices(variants,selected,"frame")' in s and 'publishedFrame' in s,
  'merchant finishes': 'physical.map(v=>attr(v,"finish"))' in s and 'finishes.map(finish=>' in s,
  'digital format only': 'selectedIsDigital&&formats.length>0&&<FormatSelector' in s,
  'canonical price and checkout': 'priceMinor' in s and 'addStoreVariant(product.store.id,selected.id,1)' in s,
  'no fabricated price': 'computeFinalUnitPrice' not in s and 'multiplier:' in s and 'selected.priceMinor' in s,
  'no legacy private cart': '/api/private/cart' not in s,
  'no cross-tenant request': 'product.store.id' in s,
}
for label,ok in checks.items():
 print(('PASS' if ok else 'FAIL'),label)
 if not ok:raise SystemExit('REFUSED: '+label)
print('ZILEDIGITAL_V38C_PRINT_OPTIONS_GUARD_PASS')
