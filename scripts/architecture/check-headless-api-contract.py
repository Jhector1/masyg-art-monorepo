#!/usr/bin/env python3
"""Validate independent catalog HTTP facade, shared delegation, CORS and OpenAPI wire schema."""
from pathlib import Path
import json,sys
repo=Path(__file__).resolve().parents[2]
spec=json.loads((repo/'contracts/openapi/commerce-public-v1.json').read_text())
assert spec['openapi']=='3.1.0'
assert spec['info']['version'].startswith('1.')
assert set(spec['paths'])=={'/v1/stores/{storeId}/products','/v1/stores/{storeId}/products/{slug}','/v1/stores/{storeId}/media/{assetId}'}
assert all(set(item)=={'get'} and item['get']['security']==[] for item in spec['paths'].values())
for route,imp in [
 ('apps/commerce-api/src/app/v1/stores/[storeId]/products/route.ts','@acme/server/api/public/stores/[storeId]/products/route'),
 ('apps/commerce-api/src/app/v1/stores/[storeId]/products/[slug]/route.ts','@acme/server/api/public/stores/[storeId]/products/[slug]/route'),
]:
 text=(repo/route).read_text()
 assert imp in text,(route,'delegation missing')
 assert 'addPublishedCatalogCors' in text and 'publishedCatalogOptions' in text
 assert 'export async function GET' in text and 'export function OPTIONS' in text
 assert 'POST' not in text and 'PUT' not in text and 'PATCH' not in text and 'DELETE' not in text
headers=(repo/'packages/server/src/lib/public-catalog-cors.ts').read_text()
assert '"Access-Control-Allow-Origin": "*"' in headers
assert '"Access-Control-Allow-Methods": "GET, OPTIONS"' in headers
assert 'Access-Control-Allow-Credentials' not in headers
assert 'headers.delete("Set-Cookie")' in headers
assert (repo/'packages/core/src/lib/public-catalog.ts').is_file()
assert (repo/'packages/server/src/api/public/stores/[storeId]/products/route.ts').is_file()
assert (repo/'packages/server/src/api/public/stores/[storeId]/products/[slug]/route.ts').is_file()
assert (repo/'apps/commerce-api/src/app/v1/health/route.ts').is_file()
# Require explicit common wire shape, no accidentally specified private asset keys.
product=spec['components']['schemas']['Product']['properties']
variant=spec['components']['schemas']['Variant']['properties']
assert set(('publicMedia','variants')) <= product.keys()
assert set(('priceMinor','currency','available')) <= variant.keys()
assert 'storageKey' not in str(spec) and 'passwordHash' not in str(spec)

media=(repo/'apps/commerce-api/src/app/v1/stores/[storeId]/media/[assetId]/route.ts').read_text()
assert 'export async function GET' in media and 'resolvePublishedStore' in media
assert 'asset: { private: false }' in media and 'status: "PUBLISHED"' in media

print("ZILEDIGITAL_HEADLESS_API_V25_V28_CONTRACT_PASS")
