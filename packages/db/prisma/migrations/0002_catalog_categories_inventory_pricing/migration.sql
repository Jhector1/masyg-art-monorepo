-- Non-destructive canonical v30 migration. Existing product prices remain unchanged.
-- compareAtMinor is a display-only regular price; priceMinor remains the payable price.
ALTER TABLE "ziledigital"."ProductVariant"
  ADD COLUMN "compareAtMinor" INTEGER;
ALTER TABLE "ziledigital"."ProductVariant"
  ADD CONSTRAINT "ProductVariant_compareAtMinor_valid"
  CHECK ("compareAtMinor" IS NULL OR "compareAtMinor" > "priceMinor");
