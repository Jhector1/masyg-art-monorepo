#!/usr/bin/env python3
"""v38F.2 regression: a physical option always carries its value and a supported key."""
from pathlib import Path
import argparse, re, subprocess, tempfile, sys
p=argparse.ArgumentParser()
p.add_argument('--repo',required=True)
a=p.parse_args()
repo=Path(a.repo).resolve()
src=(repo/'apps/ziledigital/src/components/CanonicalArtInfoModel.tsx').read_text()
start='  if (current.fulfillment === "PHYSICAL") {'
end='  // Digital choices preserve matching formats and license editions.'
if src.count(start)!=1 or src.count(end)!=1:raise SystemExit('V38F2_PHYSICAL_BRANCH_NOT_UNIQUE')
part=src.split(start,1)[1].split(end,1)[0]
keys=re.findall(r'case "([a-z]+)":',part)
if set(keys)!={'size','material','frame','finish','glazing','edition'} or len(keys)!=6:raise SystemExit('V38F2_KEYS_MISMATCH')
if 'return selectPhysicalVariant(variants,current,{key:change.key,value:change.value})' not in part:raise SystemExit('V38F2_VALUE_DROPPED')
if 'default:' not in part or 'return null;' not in part:raise SystemExit('V38F2_INVALID_KEY_NOT_REJECTED')
if 'change as ' in part:raise SystemExit('V38F2_UNSAFE_CAST')
# Typecheck the actual switch block against the canonical helper's required shape.
# This would detect the original TS2345 omission of `value`.
types="""type PublicVariant={fulfillment:string};
declare function selectPhysicalVariant(variants:readonly PublicVariant[],current:PublicVariant,change:{key:"size"|"material"|"frame"|"finish"|"glazing"|"edition";value:string}):PublicVariant|null;
function chooseVariant(variants:PublicVariant[],current:PublicVariant,change:{key:string;value:string}):PublicVariant|null {
"""
code=types+start+part+'  return null;\n}\n'
with tempfile.TemporaryDirectory(prefix='ziledigital-v38f2-') as t:
    f=Path(t)/'physical-variant-regression.ts'
    f.write_text(code)
    proc=subprocess.run(['tsc','--strict','--noEmit','--target','es2020','--skipLibCheck','--noResolve',str(f)],capture_output=True,text=True,timeout=30)
    if proc.returncode:raise SystemExit('V38F2_TSC_REGRESSION_FAILED\n'+proc.stdout+proc.stderr)
print('ZILEDIGITAL_V38F2_VARIANT_KEY_NARROWING_PASS')
