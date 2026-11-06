#!/usr/bin/env python3
# v38G: original product editing functionality kept, interface progressively disclosed.
from pathlib import Path
import argparse,subprocess
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);a=p.parse_args()
repo=Path(a.repo).resolve()
s=(repo/'apps/admin/src/components/merchant/ProductEditor.tsx').read_text()
for item in [
 'type EditorTab = "overview" | "media" | "editions" | "options" | "publish"',
 'aria-selected={section === tab.id}', 'role="tabpanel"', 'Storefront readiness',
 'Digital is not currently purchasable in the storefront', 'digitalEligibleForStore',
 'listing.product.offersDigitalLicenses', 'activeDigitalMissingFile', 'activeLicenseTiers.size >= 2',
 'licenseDuplicate', 'printDuplicate', 'hasPrivateFile(v)',
 'setEditingVariant', 'editingVariant === v.id', 'MerchantMediaStudio',
 'store.organizationId', 'store.storeId', 'mutatable(store)',
 'callMerchant(`${productUrl}/variants/${v.id}`, "PATCH"',
 'callMerchant(`${productUrl}/variants`, "POST"',
 'callMerchant(productUrl, "PATCH"', 'callMerchant(productUrl, "DELETE")',
 'status: "PUBLISHED"', 'status: "DRAFT"', 'confirmArchive !== "ARCHIVE"',
 'priceMinor = toMinor', 'compareAtMinor', 'FRAME_CHOICES', 'GLAZING_CHOICES',
 'Final price (USD)', 'Add inactive physical edition', 'inactive licensed edition',
 ]:
 if item not in s:raise SystemExit('V38G_EDITOR_MISSING: '+item)
if '/api/private/cart' in s or 'calculateFramePrice' in s or 'NEXT_PUBLIC' in s:
 raise SystemExit('V38G_LEGACY_OR_CLIENT_PRICING_REFUSED')
if s.count('role="tab"')!=1 or s.count('role="tabpanel"')!=5:
 raise SystemExit('V38G_TABS_MISMATCH')
if s.count('<MerchantMediaStudio')!=1:raise SystemExit('V38G_MEDIA_DUPLICATED')
# Parse exact TSX source using project's installed TypeScript parser.
cmd=['node','-e', '''const fs=require('fs'),ts=require('typescript');
const path=process.argv[1];const s=fs.readFileSync(path,'utf8');
const tree=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(tree.parseDiagnostics.length) {for(const d of tree.parseDiagnostics) console.error(ts.flattenDiagnosticMessageText(d.messageText,'\\n')); process.exit(2)}
console.log('V38G_TYPESCRIPT_SYNTAX_PASS');''',str(repo/'apps/admin/src/components/merchant/ProductEditor.tsx')]
proc=subprocess.run(cmd,capture_output=True,text=True,timeout=30,cwd=repo)
if proc.returncode:raise SystemExit('V38G_PARSE_FAILED: '+proc.stdout+proc.stderr)
print(proc.stdout.strip())
print('ZILEDIGITAL_V38G_EDITOR_WORKFLOW_GUARD_PASS')
