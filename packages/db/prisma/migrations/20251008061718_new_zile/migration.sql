-- Enable UUIDs (Postgres ≥13 has gen_random_uuid() in pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Product: drop stray FK column if it ever existed, add publicId, backfill, then enforce NOT NULL
ALTER TABLE "ziledigital"."Product"
  DROP COLUMN IF EXISTS "ziledigitalId",
  ADD COLUMN IF NOT EXISTS "publicId" TEXT;

UPDATE "ziledigital"."Product"
SET "publicId" = COALESCE("publicId", gen_random_uuid()::text)
WHERE "publicId" IS NULL;

ALTER TABLE "ziledigital"."Product"
  ALTER COLUMN "publicId" SET NOT NULL;

-- User: rename avatar id field to publicId-style (guarded)
ALTER TABLE "ziledigital"."User"
  DROP COLUMN IF EXISTS "avatarziledigitalId",
  ADD COLUMN IF NOT EXISTS "avatarPublicId" VARCHAR(191);

-- UserDesign: same for preview (guarded)
ALTER TABLE "ziledigital"."UserDesign"
  DROP COLUMN IF EXISTS "previewziledigitalId",
  ADD COLUMN IF NOT EXISTS "previewPublicId" VARCHAR(255);
