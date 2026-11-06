#!/usr/bin/env python3
"""ZileDigital v32 static boundaries: scoped sensitive records, staff mutation and UI routes."""
from pathlib import Path
import sys
repo=Path(__file__).resolve().parents[2]
def code(rel):
 p=repo/rel
 if not p.exists(): raise RuntimeError('MISSING '+rel)
 return p.read_text()
orders=code('packages/core/src/lib/merchant-orders-customers.ts')
staff=code('packages/core/src/lib/merchant-staff.ts')
assert 'requireMerchantAccess({ userId, organizationId, capability: "manage" })' in orders
assert 'organizationId: scope.organizationId' in orders
assert 'storeId: scope.storeId' in orders
assert 'orders: { some: { storeId: scope.storeId } }' in orders
assert 'prisma.order.findFirst' in orders and 'prisma.customer.findFirst' in orders
assert 'requireOwnerInsideTx(tx' in staff
assert 'isolationLevel: "Serializable"' in staff
assert 'guardOwnerRemoval' in staff
assert 'tx.storeMember.deleteMany' in staff and 'role: "VIEWER"' in staff
assert 'tx.merchantAuditLog.create' in staff
assert 'sendEmail' not in staff and 'platformAdmin' not in staff
for path in ['apps/admin/src/app/api/merchant/organizations/[organizationId]/staff/route.ts',
             'apps/admin/src/app/api/merchant/organizations/[organizationId]/staff/[userId]/route.ts']:
 content=code(path)
 assert 'requireMerchantPrincipal' in content and 'merchantHttpError' in content
 assert 'origin' in content and '403' in content
for path in ['apps/admin/src/app/merchant/orders/page.tsx',
             'apps/admin/src/app/merchant/orders/[orderId]/page.tsx',
             'apps/admin/src/app/merchant/customers/page.tsx',
             'apps/admin/src/app/merchant/customers/[customerId]/page.tsx',
             'apps/admin/src/app/merchant/staff/page.tsx']:
 content=code(path)
 assert 'merchantWorkspace' in content
 assert 'store.role === "MEMBER"' in content
for forbidden in ['refundPayment(', 'stripe.refunds.create(', 'updateOrderStatus(', 'setPaymentStatus(']:
 assert forbidden not in orders
print('ZILEDIGITAL_V32_BOUNDARIES_PASS')
