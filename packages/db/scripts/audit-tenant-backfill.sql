-- Read-only verification AFTER migration. Set the search_path to your Prisma schema.
SELECT 'Product' AS table_name, count(*) AS total,
  count(*) FILTER (WHERE "organizationId" IS NULL OR "storeId" IS NULL) AS unscoped
FROM "Product"
UNION ALL
SELECT 'Order', count(*), count(*) FILTER (WHERE "organizationId" IS NULL OR "storeId" IS NULL) FROM "Order"
UNION ALL
SELECT 'Cart', count(*), count(*) FILTER (WHERE "organizationId" IS NULL OR "storeId" IS NULL) FROM "Cart"
UNION ALL
SELECT 'Favorite', count(*), count(*) FILTER (WHERE "organizationId" IS NULL OR "storeId" IS NULL) FROM "Favorite";

SELECT s."slug", s."organizationId", count(p."id") AS product_count
FROM "Store" s LEFT JOIN "Product" p ON p."storeId" = s."id"
GROUP BY s."id", s."slug", s."organizationId" ORDER BY s."slug";

SELECT o."slug", count(m."userId") AS assigned_members
FROM "Organization" o LEFT JOIN "OrganizationMember" m ON m."organizationId" = o."id"
GROUP BY o."id", o."slug" ORDER BY o."slug";
