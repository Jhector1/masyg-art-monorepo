#!/usr/bin/env python3
"""Guard that retired global merchant handlers are not reintroduced."""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
retired=[
 "apps/admin/src/services/admin/categories.ts",
 "apps/admin/src/services/admin/dashboard.ts",
 "apps/admin/src/services/admin/orders.ts",
 "apps/admin/src/services/admin/users.ts",
 "apps/admin/src/app/api/admin/categories/route.ts",
 "apps/admin/src/app/api/admin/categories/[id]/route.ts",
 "apps/admin/src/app/api/admin/orders/route.ts",
 "apps/admin/src/app/api/admin/orders/[id]/route.ts",
 "apps/admin/src/app/api/admin/users/route.ts",
 "apps/admin/src/app/admin/private/categories/page.tsx",
 "apps/admin/src/app/admin/private/orders/page.tsx",
 "apps/admin/src/app/admin/private/users/page.tsx",
]
for rel in retired:
 if (root/rel).exists(): raise SystemExit(f"RETIRED_GLOBAL_ADMIN_PRESENT {rel}")
for rel in ["apps/admin/src/app/admin/page.tsx", "apps/admin/src/components/ClientFrame.tsx"]:
 text=(root/rel).read_text()
 if "/admin/private/" in text or "@/services/admin/" in text:
  raise SystemExit(f"LEGACY_ADMIN_REFERENCE {rel}")
for rel in ["apps/admin/src/app/merchant/page.tsx", "apps/admin/src/lib/merchant-session.ts", "apps/admin/src/middleware.ts"]:
 if not (root/rel).is_file(): raise SystemExit(f"CANONICAL_MERCHANT_MISSING {rel}")
print("ZILEDIGITAL_ADMIN_V26_1_BOUNDARY_PASS")
