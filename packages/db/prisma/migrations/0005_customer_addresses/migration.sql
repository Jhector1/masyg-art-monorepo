-- v34C: buyer-owned, store-scoped saved addresses. Additive only.
-- Order.shippingAddress continues as the immutable shipping snapshot.
CREATE TABLE "ziledigital"."CustomerAddress" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" VARCHAR(60),
  "street" VARCHAR(200) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "state" VARCHAR(120) NOT NULL,
  "postalCode" VARCHAR(30) NOT NULL,
  "country" VARCHAR(2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAddress_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "ziledigital"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerAddress_organizationId_storeId_fkey"
    FOREIGN KEY ("organizationId", "storeId") REFERENCES "ziledigital"."Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerAddress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerAddress_country_ck" CHECK ("country" ~ '^[A-Z]{2}$'),
  CONSTRAINT "CustomerAddress_street_nonblank_ck" CHECK (length(trim("street")) > 0)
);
CREATE INDEX "CustomerAddress_organizationId_storeId_userId_createdAt_idx"
  ON "ziledigital"."CustomerAddress"("organizationId", "storeId", "userId", "createdAt");
