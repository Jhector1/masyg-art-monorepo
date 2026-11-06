#!/usr/bin/env python3
"""Collect only source needed for commerce cutover review; never packages secrets deliberately."""
from pathlib import Path
import argparse, zipfile, re, sys
p=argparse.ArgumentParser();p.add_argument('--repo', default='.')
p.add_argument('--output',required=True); a=p.parse_args()
repo=Path(a.repo).resolve(); dst=Path(a.output).expanduser().resolve()
roots=[f'apps/{a}/src' for a in ('ziledigital','jeanyvesart','admin')]
roots+=['packages/core/src','packages/server/src','packages/db/prisma','packages/auth/src', 'packages/ui/src']
exact=['package.json','turbo.json','tsconfig.json','apps/ziledigital/package.json','apps/jeanyvesart/package.json','apps/admin/package.json','packages/core/package.json','packages/server/package.json','packages/db/package.json','packages/auth/package.json','packages/core/jest.config.cjs']
allowed={'.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.prisma','.css','.scss'}
blocked={'node_modules','.next','dist','build','.git','coverage','__MACOSX'}
# Reject obvious private names in any folder; use a whitelist of code types too.
secret=re.compile(r'(?:^|[._-])(?:env|secret|credentials?|private[-_]?key|token|passwd|passwords)(?:$|[._-])',re.I)
paths=set()
for root in roots:
 directory=repo/root
 if not directory.is_dir():continue
 for f in directory.rglob('*'):
  if not f.is_file() or f.suffix.lower() not in allowed:continue
  rel=f.relative_to(repo)
  if any(x in blocked for x in rel.parts) or secret.search(f.name):continue
  if f.stat().st_size>3_000_000:continue
  paths.add(rel.as_posix())
for name in exact:
 f=repo/name
 if f.is_file() and f.stat().st_size<=3_000_000: paths.add(name)
if not paths:sys.exit('No code files found')
if dst.is_relative_to(repo) and (dst.relative_to(repo).as_posix() in paths):sys.exit('Output overlaps source')
dst.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(paths): z.write(repo/path,arcname=path)
print(f'ZILEDIGITAL_REVIEW_SOURCE_ARCHIVE_CREATED {dst} ({len(paths)} files)')
print('Review ZIP contents before sharing: source files can contain hardcoded secrets.')
