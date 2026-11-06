-- Additive merchant-scoped TEST checkout shipping settings. No legacy data changes.
CREATE TABLE "StoreShippingConfiguration" (
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "physicalTaxCode" VARCHAR(13),
    "shippingTaxCode" VARCHAR(13),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreShippingConfiguration_pkey" PRIMARY KEY ("organizationId","storeId")
);
CREATE TABLE "StoreShippingRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "region" VARCHAR(16) NOT NULL DEFAULT '',
    "currency" VARCHAR(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreShippingRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoreShippingRate_amountMinor_nonnegative" CHECK ("amountMinor" >= 0)
);
CREATE UNIQUE INDEX "StoreShippingRate_organizationId_storeId_country_region_currency_key"
    ON "StoreShippingRate"("organizationId","storeId","country","region","currency");
CREATE INDEX "StoreShippingRate_organizationId_storeId_enabled_idx"
    ON "StoreShippingRate"("organizationId","storeId","enabled");
ALTER TABLE "StoreShippingConfiguration" ADD CONSTRAINT "StoreShippingConfiguration_organizationId_storeId_fkey"
    FOREIGN KEY ("organizationId","storeId") REFERENCES "Storefront"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreShippingRate" ADD CONSTRAINT "StoreShippingRate_organizationId_storeId_fkey"
    FOREIGN KEY ("organizationId","storeId") REFERENCES "Storefront"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE;
