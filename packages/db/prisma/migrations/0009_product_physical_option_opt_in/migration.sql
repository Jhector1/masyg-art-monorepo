-- Tenant-owned product-level controls; additive, no existing product or order mutation.
ALTER TABLE "ziledigital"."Product" ADD COLUMN "offersFraming" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ziledigital"."Product" ADD COLUMN "offersGlazing" BOOLEAN NOT NULL DEFAULT false;
