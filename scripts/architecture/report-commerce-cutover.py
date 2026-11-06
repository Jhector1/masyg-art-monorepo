#!/usr/bin/env python3
"""Summarize the remaining source-level commerce boundary work. Read-only."""
from pathlib import Path
from collections import Counter
import subprocess, sys
repo=Path(__file__).resolve().parents[2]
scanner=repo/'scripts/architecture/audit-commerce-boundaries.py'
run=subprocess.run([sys.executable,str(scanner),'--repo',str(repo)],capture_output=True,text=True)
if run.returncode not in (0,1):
    print(run.stderr,file=sys.stderr);sys.exit(run.returncode)
findings=[x for x in run.stdout.splitlines() if ': apps/' in x]
print('COMMERCE_REMAINING_FINDINGS',len(findings))
for k,n in sorted(Counter(x.split(':',1)[0] for x in findings).items()):print(f'{k}: {n}')
print('The remaining frontend callers and app-local logic must be migrated before release.')
