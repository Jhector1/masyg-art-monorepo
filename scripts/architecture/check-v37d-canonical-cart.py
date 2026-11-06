#!/usr/bin/env python3
"""Fail closed if storefronts regress to the user-private legacy cart."""
import argparse
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument("--repo",required=True)
root=Path(parser.parse_args().repo)
read=lambda rel:(root/rel).read_text()
context=read("packages/core/src/contexts/CartContext.tsx")
transport=read("packages/core/src/lib/client/storefront-commerce.ts")
bridge=read("packages/core/src/lib/client/legacy-cart-bridge.ts")
original=read("apps/jeanyvesart/src/components/store/painting/OriginalArtworkDetails.tsx")
assert "/api/private/cart" not in context
assert "getCurrentStorefront" in context and "getStoreCart" in context
assert "addStoreVariant" in context and "setStoreVariantQuantity" in context
assert "STORE_CART_UPDATED_EVENT" in context and "STORE_CART_UPDATED_EVENT" in transport
assert "design-snapshot" in bridge and "Select an exact available variant" in bridge
assert "addStoreVariant" in original and "method:" not in original
print("ZILEDIGITAL_V37D_CANONICAL_CART_GUARD_PASS")
