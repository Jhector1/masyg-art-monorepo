#!/usr/bin/env python3
"""Regression guard for v38F.1: Admin attribute keys stay aligned with merchant variants."""
from pathlib import Path
import re, subprocess, sys, tempfile
repo=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
shared=(repo/'apps/admin/src/components/merchant/shared.tsx').read_text()
editor=(repo/'apps/admin/src/components/merchant/ProductEditor.tsx').read_text()
m=re.search(r'export function attr\(attributes: unknown, key: ([^)]+)\) \{(.*?)\n\}',shared,re.S)
if not m: raise SystemExit('ZILEDIGITAL_V38F1_ATTRIBUTE_SIGNATURE_MISSING')
keys=re.findall(r'"([a-z]+)"',m.group(1))
expected={'size','material','format','edition','finish','license','frame','glazing'}
if set(keys)!=expected or len(keys)!=len(expected):
 raise SystemExit('ZILEDIGITAL_V38F1_ATTRIBUTE_KEYS_INCORRECT: '+str(keys))
if not all('attr(variant.attributes,"'+k+'")' in editor.replace(' ','') for k in ('frame','glazing')):
 raise SystemExit('ZILEDIGITAL_V38F1_EDITOR_NOT_USING_SHARED_HELPER')
code=m.group(0)+"""
let result: string = '';
result = attr({frame:'Black wood'}, 'frame');
result = attr({glazing:'UV acrylic'}, 'glazing');
result = attr({license:'commercial'}, 'license');
result = attr(null, 'size');
// @ts-expect-error Unknown attributes must remain rejected by the typed helper.
result = attr({}, 'not-a-commerce-attribute');
"""
with tempfile.TemporaryDirectory(prefix='ziledigital-v38f1-') as t:
 p=Path(t)/'attr-type-regression.ts';p.write_text(code)
 args=['tsc','--noEmit','--strict','--target','es2020','--skipLibCheck','--noResolve',str(p)]
 try: proc=subprocess.run(args,capture_output=True,text=True,timeout=25)
 except FileNotFoundError:raise SystemExit('TSC_REQUIRED_FOR_V38F1_GUARD')
 if proc.returncode: raise SystemExit('ZILEDIGITAL_V38F1_TYPECHECK_FAILED\n'+proc.stdout+proc.stderr)
print('ZILEDIGITAL_V38F1_ADMIN_ATTRIBUTE_KEYS_PASS')
