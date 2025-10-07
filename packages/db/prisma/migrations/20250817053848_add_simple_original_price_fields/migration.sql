-- 1) Add column as NULLABLE (use NUMERIC for money)
ALTER TABLE "ziledigital"."CartItem"
  ADD COLUMN IF NOT EXISTS "originalPrice" NUMERIC(10,2);

-- 2) Backfill from price first (so existing rows get a value)
UPDATE "ziledigital"."CartItem"
SET "originalPrice" = COALESCE("originalPrice", "price");

-- 3) If compareAt exists, prefer it (guarded for shadow DB)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'ziledigital'
      AND table_name   = 'CartItem'
      AND column_name  = 'compareAt'
  ) THEN
    UPDATE "ziledigital"."CartItem"
    SET "originalPrice" = COALESCE("compareAt", "originalPrice");
  END IF;
END $$;

-- 4) Safety fill (should be unnecessary after steps above, but defensive)
UPDATE "ziledigital"."CartItem"
SET "originalPrice" = 0
WHERE "originalPrice" IS NULL;

-- 5) Enforce NOT NULL
ALTER TABLE "ziledigital"."CartItem"
  ALTER COLUMN "originalPrice" SET NOT NULL;
