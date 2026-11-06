-- v31 additive media metadata and immutable digital-file retirement.
-- No existing media, purchase snapshot, or grants are deleted.
ALTER TABLE "ziledigital"."ProductMedia"
 ADD COLUMN "altText" VARCHAR(180);
ALTER TABLE "ziledigital"."DigitalFile"
 ADD COLUMN "retiredAt" TIMESTAMP(3);
CREATE INDEX "DigitalFile_org_variant_active_idx"
 ON "ziledigital"."DigitalFile" ("organizationId", "variantId", "retiredAt");
