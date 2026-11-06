#!/usr/bin/env python3
"""Store IDs must be copied from the authenticated, tenant-scoped Merchant workspace."""
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--repo", required=True)
root = Path(parser.parse_args().repo).resolve()
read = lambda name: (root / name).read_text()
page = read("apps/admin/src/app/merchant/storefronts/settings/page.tsx")
panel = read("apps/admin/src/components/merchant/StoreIdentityPanel.tsx")
storefronts = read("apps/admin/src/components/merchant/StorefrontPanel.tsx")
workspace = read("apps/admin/src/lib/merchant-workspace.ts")
nav = read("apps/admin/src/components/ClientFrame.tsx")
assert "await merchantWorkspace(searchParams)" in page
assert 'pathname="/merchant/storefronts/settings"' in page
assert "<StoreIdentityPanel store={store}/>" in page
assert "requireMerchantPrincipal()" in workspace
assert "listMerchantOrganizations(userId)" in workspace
assert "stores.some(s => s.storeId === requested)" in workspace
assert "store.organizationId" in panel and "store.storeId" in panel
assert "ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID=" in panel
assert "ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID=" in panel
assert "navigator.clipboard.writeText(value)" in panel
assert 'readOnly value={store.organizationId}' in panel
assert 'readOnly value={store.storeId}' in panel
assert "store.published" in panel
assert "merchant/storefronts/settings" in storefronts
assert "storeQuery(store.storeId)" in storefronts
assert 'pathname.startsWith("/merchant/storefronts/")' in nav
assert not (root / "apps/admin/src/app/api/merchant/store-identity").exists(), "Do not create unscoped identity API"
print("ZILEDIGITAL_V37C_STORE_IDENTITY_BOUNDARIES_PASS")
