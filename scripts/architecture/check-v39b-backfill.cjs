/** Read-only local verification after v39B migration. Run through migrate runner's safe env. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const [variantCount, linkedCount, offeringCount, invalid] = await Promise.all([
    prisma.productVariant.count(),
    prisma.productVariant.count({ where: { offeringId: { not: null } } }),
    prisma.productOffering.count(),
    prisma.$queryRaw`
      SELECT COUNT(*)::integer AS count FROM "ziledigital"."ProductVariant" v
      LEFT JOIN "ziledigital"."ProductOffering" o
      ON o."organizationId" = v."organizationId"
      AND o."productId" = v."productId" AND o."id" = v."offeringId"
      WHERE v."offeringId" IS NOT NULL AND (
        o."id" IS NULL OR
        (v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind" AND o."kind" != 'DOWNLOAD'::"ziledigital"."OfferingKind") OR
        (v."fulfillment" = 'PHYSICAL'::"ziledigital"."FulfillmentKind" AND o."kind" != 'MERCHANDISE'::"ziledigital"."OfferingKind")
      )`
  ]);
  console.log({ variantCount, linkedCount, offeringCount, invalidLinks: invalid[0]?.count ?? null });
  if (invalid[0]?.count !== 0) process.exitCode = 2;
  // NULL offering links may occur for NEW variants created after the migration by old API paths.
  if (linkedCount !== variantCount) console.log('NOTE: unlinked variants may be newly created through compatibility routes');
})().catch(e => { console.error('READ_ONLY_BACKFILL_AUDIT_FAILED:', e.message); process.exitCode = 2; })
.finally(() => prisma.$disconnect());
