#!/usr/bin/env python3
"""Static safety guard for v39B's additive Prisma schema/migration.

This does not replace a real Prisma validate, migration deploy, or database audit.
"""
import argparse
import re
import sys
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--repo', required=True)
a = p.parse_args()
root = Path(a.repo).resolve()
schema_path = root / 'packages/db/prisma/schema.prisma'
sql_path = root / 'packages/db/prisma/migrations/0010_product_offerings_option_groups/migration.sql'

try:
    schema = schema_path.read_text()
    sql = sql_path.read_text()
    forbidden = re.compile(r'\b(?:DROP\s+(?:TABLE|SCHEMA|COLUMN|TYPE)|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE[^;]*?DROP\b)\b', re.I | re.S)
    assert not forbidden.search(sql), 'destructive SQL prohibited'
    assert sql.strip().startswith('-- ZileDigital v39B') and sql.strip().endswith('COMMIT;'), 'migration must be transaction-scoped'
    required_schema = (
        'enum OfferingKind {',
        'model ProductOffering {',
        'model CatalogOptionGroup {',
        'model CatalogOptionValue {',
        'model OfferingOptionGroup {',
        'offeringId     String? // optional until all variant creation paths adopt offerings',
        'offering       ProductOffering? @relation(fields: [organizationId, productId, offeringId], references: [organizationId, productId, id], onDelete: Restrict)',
        '@@unique([organizationId, productId, id])',
        '@@unique([organizationId, productId, slug])',
        '@@unique([organizationId, groupId, key])',
        '@@id([organizationId, productId, offeringId, groupId], map: "OfferingOptionGroup_pkey")',
    )
    for term in required_schema:
        assert term in schema, f'missing schema invariant: {term}'
    required_sql = (
        'CREATE TABLE "ziledigital"."ProductOffering"',
        'CREATE TABLE "ziledigital"."CatalogOptionGroup"',
        'CREATE TABLE "ziledigital"."CatalogOptionValue"',
        'CREATE TABLE "ziledigital"."OfferingOptionGroup"',
        'ALTER TABLE "ziledigital"."ProductVariant" ADD COLUMN "offeringId" TEXT;',
        'JOIN "ziledigital"."Product" p',
        "THEN 'DOWNLOAD'::\"ziledigital\".\"OfferingKind\" ELSE 'MERCHANDISE'::\"ziledigital\".\"OfferingKind\" END",
        'UPDATE "ziledigital"."ProductVariant" v',
        'SET "offeringId" = CASE',
        'FOREIGN KEY ("organizationId", "productId", "offeringId")',
        'FOREIGN KEY ("organizationId", "productId") REFERENCES "ziledigital"."Product"',
        'FOREIGN KEY ("organizationId", "groupId") REFERENCES "ziledigital"."CatalogOptionGroup"',
        "RAISE EXCEPTION 'ZILEDIGITAL_V39B_BACKFILL_INVALID'",
    )
    for term in required_sql:
        assert term in sql, f'missing SQL invariant: {term}'
    assert sql.count('INSERT INTO "ziledigital"."ProductOffering"') == 1
    assert sql.count('UPDATE "ziledigital"."ProductVariant" v') == 1
    assert sql.count('ADD CONSTRAINT ') == 7, 'Unexpected foreign-key change count'
    print('ZILEDIGITAL_V39B_SCHEMA_GUARD_PASS')
except (AssertionError, OSError) as ex:
    print('ZILEDIGITAL_V39B_SCHEMA_GUARD_FAIL', str(ex), file=sys.stderr)
    sys.exit(2)
