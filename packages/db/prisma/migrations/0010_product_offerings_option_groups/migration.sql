-- ZileDigital v39B: additive tenant-isolated offering and reusable option vocabulary.
-- Does NOT change customer-facing prices, inventory, fulfillment, carts, or orders.
-- All existing variants remain sellable through the unchanged v39A checkout paths.
BEGIN;

CREATE TYPE "ziledigital"."OfferingKind" AS ENUM ('ORIGINAL', 'PRINT', 'DOWNLOAD', 'MERCHANDISE');

CREATE TABLE "ziledigital"."ProductOffering" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "kind" "ziledigital"."OfferingKind" NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "ziledigital"."PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductOffering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ziledigital"."CatalogOptionGroup" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogOptionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ziledigital"."CatalogOptionValue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ziledigital"."OfferingOptionGroup" (
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OfferingOptionGroup_pkey" PRIMARY KEY ("organizationId", "productId", "offeringId", "groupId")
);

ALTER TABLE "ziledigital"."ProductVariant" ADD COLUMN "offeringId" TEXT;

CREATE UNIQUE INDEX "ProductOffering_organizationId_id_key" ON "ziledigital"."ProductOffering"("organizationId", "id");
CREATE UNIQUE INDEX "ProductOffering_organizationId_productId_id_key" ON "ziledigital"."ProductOffering"("organizationId", "productId", "id");
CREATE UNIQUE INDEX "ProductOffering_organizationId_productId_slug_key" ON "ziledigital"."ProductOffering"("organizationId", "productId", "slug");
CREATE INDEX "ProductOffering_organizationId_productId_sortOrder_idx" ON "ziledigital"."ProductOffering"("organizationId", "productId", "sortOrder");
CREATE UNIQUE INDEX "CatalogOptionGroup_organizationId_id_key" ON "ziledigital"."CatalogOptionGroup"("organizationId", "id");
CREATE UNIQUE INDEX "CatalogOptionGroup_organizationId_key_key" ON "ziledigital"."CatalogOptionGroup"("organizationId", "key");
CREATE UNIQUE INDEX "CatalogOptionValue_organizationId_groupId_id_key" ON "ziledigital"."CatalogOptionValue"("organizationId", "groupId", "id");
CREATE UNIQUE INDEX "CatalogOptionValue_organizationId_groupId_key_key" ON "ziledigital"."CatalogOptionValue"("organizationId", "groupId", "key");
CREATE INDEX "CatalogOptionValue_organizationId_groupId_sortOrder_idx" ON "ziledigital"."CatalogOptionValue"("organizationId", "groupId", "sortOrder");
CREATE INDEX "OfferingOptionGroup_organizationId_groupId_idx" ON "ziledigital"."OfferingOptionGroup"("organizationId", "groupId");
CREATE INDEX "ProductVariant_organizationId_productId_offeringId_idx" ON "ziledigital"."ProductVariant"("organizationId", "productId", "offeringId");

ALTER TABLE "ziledigital"."ProductOffering" ADD CONSTRAINT "ProductOffering_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "ziledigital"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ziledigital"."ProductOffering" ADD CONSTRAINT "ProductOffering_organizationId_productId_fkey"
  FOREIGN KEY ("organizationId", "productId") REFERENCES "ziledigital"."Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ziledigital"."CatalogOptionGroup" ADD CONSTRAINT "CatalogOptionGroup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "ziledigital"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ziledigital"."CatalogOptionValue" ADD CONSTRAINT "CatalogOptionValue_organizationId_groupId_fkey"
  FOREIGN KEY ("organizationId", "groupId") REFERENCES "ziledigital"."CatalogOptionGroup"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ziledigital"."OfferingOptionGroup" ADD CONSTRAINT "OfferingOptionGroup_organizationId_productId_offeringId_fkey"
  FOREIGN KEY ("organizationId", "productId", "offeringId") REFERENCES "ziledigital"."ProductOffering"("organizationId", "productId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ziledigital"."OfferingOptionGroup" ADD CONSTRAINT "OfferingOptionGroup_organizationId_groupId_fkey"
  FOREIGN KEY ("organizationId", "groupId") REFERENCES "ziledigital"."CatalogOptionGroup"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conservative, deterministic compatibility backfill. A PHYSICAL SKU is never
-- presumed to be an art print or an original. Merchants can reclassify later.
-- Product and listing publication state continue to be checked independently.
INSERT INTO "ziledigital"."ProductOffering"
  ("id", "organizationId", "productId", "kind", "name", "slug", "status", "sortOrder", "createdAt", "updatedAt")
SELECT DISTINCT
  CASE WHEN v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind"
    THEN 'v39b_download_' || v."productId" ELSE 'v39b_physical_' || v."productId" END,
  v."organizationId", v."productId",
  CASE WHEN v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind"
    THEN 'DOWNLOAD'::"ziledigital"."OfferingKind" ELSE 'MERCHANDISE'::"ziledigital"."OfferingKind" END,
  CASE WHEN v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind"
    THEN 'Digital download' ELSE 'Physical item' END,
  CASE WHEN v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind"
    THEN 'legacy-download' ELSE 'legacy-physical' END,
  p."status",
  CASE WHEN v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind" THEN 1 ELSE 0 END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ziledigital"."ProductVariant" v
JOIN "ziledigital"."Product" p
  ON p."organizationId" = v."organizationId" AND p."id" = v."productId";

UPDATE "ziledigital"."ProductVariant" v
SET "offeringId" = CASE WHEN v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind"
  THEN 'v39b_download_' || v."productId" ELSE 'v39b_physical_' || v."productId" END;

ALTER TABLE "ziledigital"."ProductVariant" ADD CONSTRAINT "ProductVariant_organizationId_productId_offeringId_fkey"
  FOREIGN KEY ("organizationId", "productId", "offeringId")
  REFERENCES "ziledigital"."ProductOffering"("organizationId", "productId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defensively prevent partial backfill or an incorrect fulfillment classification.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ziledigital"."ProductVariant" v
    LEFT JOIN "ziledigital"."ProductOffering" o
      ON o."organizationId" = v."organizationId" AND o."productId" = v."productId" AND o."id" = v."offeringId"
    WHERE o."id" IS NULL OR
      (v."fulfillment" = 'DIGITAL'::"ziledigital"."FulfillmentKind" AND o."kind" <> 'DOWNLOAD'::"ziledigital"."OfferingKind") OR
      (v."fulfillment" = 'PHYSICAL'::"ziledigital"."FulfillmentKind" AND o."kind" <> 'MERCHANDISE'::"ziledigital"."OfferingKind")
  ) THEN
    RAISE EXCEPTION 'ZILEDIGITAL_V39B_BACKFILL_INVALID';
  END IF;
END $$;

COMMIT;
