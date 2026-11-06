#!/usr/bin/env python3
"""Static boundary checks. For real authorization use PostgreSQL-backed acceptance, too."""
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
def src(path):
    f=repo/path
    assert f.exists(),f"Missing {path}"
    return f.read_text()
inv=src('packages/core/src/lib/merchant-invitations.ts')
assert 'randomBytes(32)' in inv and 'createHash("sha256")' in inv and 'tokenHash' in inv
assert '"Serializable"' in inv and 'user.email.trim().toLowerCase() !== invitation.email' in inv
assert 'deliveryStatus: "SENT"' in inv and 'acceptedAt: null' in inv and 'revokedAt: null' in inv
assert 'organizationMember.create' in inv and 'storeMember.create' in inv and 'activeKey: null' in inv
assert 'requireMerchantAccess' in inv and 'actor?.role !== "OWNER"' in inv
routes=[
'apps/admin/src/app/api/merchant/organizations/[organizationId]/invitations/route.ts',
'apps/admin/src/app/api/merchant/organizations/[organizationId]/invitations/[invitationId]/route.ts',
'apps/admin/src/app/api/merchant/invitations/accept/route.ts',
'apps/admin/src/app/api/merchant/organizations/[organizationId]/stores/[storeId]/customers/[customerId]/notes/route.ts',
'apps/admin/src/app/api/merchant/organizations/[organizationId]/stores/[storeId]/orders/[orderId]/shipment-plans/route.ts',
]
for route in routes:
    text=src(route)
    assert 'requireMerchantPrincipal' in text
    if 'export async function POST' in text or 'export async function DELETE' in text:
        assert '"Origin not allowed"' in text
mail=src('apps/admin/src/lib/merchant-invite-delivery.ts')
assert 'https://api.resend.com/emails' in mail and 'RESEND_API_KEY' in mail
assert 'to: [args.email]' in mail and '#token=' in mail
assert 'Authorization: `Bearer' in mail
middleware=src('apps/admin/src/middleware.ts')
assert 'path === "/merchant/invitations/accept"' in middleware
assert '(req.method === "GET" || req.method === "HEAD")' in middleware
note=src('packages/core/src/lib/merchant-customer-notes.ts')
assert 'orders: { some: { storeId:' in note and 'customerNote.create' in note
assert '"Serializable"' in note and 'merchantAuditLog.create' in note
shipment=src('packages/core/src/lib/merchant-shipment-plans.ts')
assert '"PAID"' in shipment and '"FULFILLING"' in shipment
assert 'status: "PENDING"' in shipment and 'planKey' in shipment
assert 'alreadyPlanned' in shipment and '"Serializable"' in shipment and 'planFingerprint' in shipment
assert 'shipmentItem.createMany' in shipment and 'merchantAuditLog.create' in shipment
assert 'order.update' not in shipment and 'payment.update' not in shipment and 'inventoryLevel.update' not in shipment
migration=src('packages/db/prisma/migrations/0004_staff_invitations_customer_notes/migration.sql').lower()
assert 'drop table' not in migration and 'truncate' not in migration and 'delete from' not in migration
assert 'staffinvitation' in migration and 'customernote' in migration and 'plankey' in migration
print('ZILEDIGITAL_V33_STATIC_BOUNDARIES_PASS')
