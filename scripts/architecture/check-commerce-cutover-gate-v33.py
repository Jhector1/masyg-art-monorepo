#!/usr/bin/env python3
"""Keep the commerce migration visible. --release refuses ANY remaining legacy finding."""
import argparse,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--release',action='store_true');p.add_argument('--baseline',type=int,default=48);args=p.parse_args()
root=Path(__file__).resolve().parents[2]
run=subprocess.run([sys.executable,str(root/'scripts/architecture/audit-commerce-boundaries.py'),'--repo',str(root)],capture_output=True,text=True)
if run.returncode not in (0,1):
    print(run.stderr,file=sys.stderr);sys.exit(run.returncode)
rows=[line for line in run.stdout.splitlines() if ': apps/' in line]
from collections import Counter
print('ZILEDIGITAL_V33_REMAINING_CUTOVER_FINDINGS',len(rows))
for kind,count in sorted(Counter(line.split(':',1)[0] for line in rows).items()):print(f'{kind}: {count}')
if args.release and rows:
    print('RELEASE_BLOCKED: all remaining commerce boundary findings must be eliminated',file=sys.stderr);sys.exit(1)
if len(rows)>args.baseline:
    print(f'REGRESSION: {len(rows)} findings exceeds accepted audit baseline of {args.baseline}',file=sys.stderr);sys.exit(1)
print('CUTOVER_BASELINE_CHECK_PASS' if not args.release else 'CUTOVER_RELEASE_CHECK_PASS')
