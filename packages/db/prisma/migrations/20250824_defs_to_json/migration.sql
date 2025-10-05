-- UserDesign.defs: String? or jsonb -> jsonb
ALTER TABLE "UserDesign"
ALTER COLUMN "defs" TYPE jsonb
USING CASE
  WHEN "defs" IS NULL THEN NULL
  WHEN ("defs"::text) ~ '^\s*(\{|\[|")' THEN ("defs"::text)::jsonb
  ELSE to_jsonb("defs"::text)
END;

-- PurchasedDesign.defs: String? or jsonb -> jsonb
ALTER TABLE "PurchasedDesign"
ALTER COLUMN "defs" TYPE jsonb
USING CASE
  WHEN "defs" IS NULL THEN NULL
  WHEN ("defs"::text) ~ '^\s*(\{|\[|")' THEN ("defs"::text)::jsonb
  ELSE to_jsonb("defs"::text)
END;
