#!/usr/bin/env python3
"""Static v39C guard, intentionally does not connect to a database."""
import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);args=p.parse_args();root=Path(args.repo)
def read(path):
    file=root/path
    if not file.is_file():raise AssertionError(f'Missing {path}')
    return file.read_text()
service=read('packages/core/src/lib/merchant-offerings.ts')
route=read('apps/admin/src/app/api/merchant/organizations/[organizationId]/products/[productId]/offerings/route.ts')
editor=read('apps/admin/src/components/merchant/ProductEditor.tsx')
manager=read('apps/admin/src/components/merchant/OfferingManager.tsx')
policy=read('packages/core/src/lib/offering-workflow-policy.ts')
schema=read('packages/db/prisma/schema.prisma')
assert 'model ProductOffering {' in schema and 'offeringId     String?' in schema
for txt in ('requireMerchantAccess','capability: "manage"','organizationId: access.organizationId',
            'productId', 'TenantAccessError(404)', 'offeringMatchesFulfillment',
            'tx.productVariant.updateMany', 'tx.merchantAuditLog.create', 'variant.offeringId !== offeringId'):
    assert txt in service, f'Service guard: {txt}'
for txt in ('requireMerchantPrincipal','merchantHttpError','z.discriminatedUnion','getMerchantOfferings',
            'createMerchantOffering','updateMerchantOffering','assignMerchantVariantOffering',
            '"Cache-Control":"private, no-store"'):
    assert txt in route, f'Route guard: {txt}'
assert 'storeId' in route and 'storeListing.findFirst' in service
assert 'offeringMatchesFulfillment' in policy and 'DOWNLOAD' in policy
assert 'OfferingManager' in editor and 'Ways to sell' in editor
assert 'compatible(offering.kind,variant.fulfillment)' in manager
for danger in ('checkout-transaction', 'stripe', 'providerCharge', 'deleteMany', 'prisma.$executeRawUnsafe'):
    assert danger not in service.lower(), danger
print('ZILEDIGITAL_V39C_TENANT_METADATA_GUARD_PASS')
