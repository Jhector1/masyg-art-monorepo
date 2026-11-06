#!/usr/bin/env python3
"""Fail on broken relative route re-exports. Read-only; zero provider/database calls."""
from pathlib import Path
import argparse,re,sys
p=argparse.ArgumentParser();p.add_argument('--repo',required=True)
a=p.parse_args();repo=Path(a.repo).resolve()
errors=[];count=0
pattern=re.compile(r'''\bexport\s*\{[^}]*\}\s*from\s*['\"](\.[^'\"]+)['\"]''',re.S)
for app in ('ziledigital','jeanyvesart','admin'):
  directory=repo/'apps'/app/'src/app/api'
  if not directory.is_dir():
    errors.append(f'MISSING_ROUTE_DIRECTORY {directory}');continue
  for file in directory.rglob('route.ts'):
    source=file.read_text(encoding='utf-8')
    for spec in pattern.findall(source):
      count+=1
      dest=file.parent/spec
      if not any(Path(str(dest)+ext).is_file() for ext in ('','.ts','.tsx','.js','.mjs','.cjs')):
        errors.append(f'BROKEN_RELATIVE_ROUTE_EXPORT {file.relative_to(repo)} -> {spec}')
if errors:
  print('\n'.join(errors));print(f'RELATIVE_ROUTE_EXPORTS_FAILED {len(errors)}');sys.exit(1)
print(f'RELATIVE_ROUTE_EXPORTS_PASS {count} relative re-export(s) checked')
