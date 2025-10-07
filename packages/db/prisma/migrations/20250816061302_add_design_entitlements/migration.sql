/*
  Warnings:

  - You are about to drop the column `editQuota` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `editsUsed` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `exportQuota` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `exportsUsed` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `purchased` on the `UserDesign` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ziledigital"."EntitlementSource" AS ENUM ('PURCHASE', 'TOPUP', 'GRANT');

-- CreateEnum
CREATE TYPE "ziledigital"."UsageKind" AS ENUM ('EXPORT', 'EDIT');

-- AlterTable
ALTER TABLE "ziledigital"."UserDesign" DROP COLUMN "editQuota",
DROP COLUMN "editsUsed",
DROP COLUMN "exportQuota",
DROP COLUMN "exportsUsed",
DROP COLUMN "purchased";

-- CreateTable
CREATE TABLE "ziledigital"."DesignEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "productId" TEXT NOT NULL,
    "userDesignId" TEXT,
    "purchasedDesignId" TEXT,
    "source" "ziledigital"."EntitlementSource" NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "exportQuota" INTEGER NOT NULL DEFAULT 0,
    "editQuota" INTEGER NOT NULL DEFAULT 0,
    "exportsUsed" INTEGER NOT NULL DEFAULT 0,
    "editsUsed" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ziledigital"."DesignUsage" (
    "id" TEXT NOT NULL,
    "kind" "ziledigital"."UsageKind" NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "productId" TEXT NOT NULL,
    "userDesignId" TEXT,
    "purchasedDesignId" TEXT,
    "entitlementId" TEXT NOT NULL,
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "meta" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignEntitlement_userId_idx" ON "ziledigital"."DesignEntitlement"("userId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_guestId_idx" ON "ziledigital"."DesignEntitlement"("guestId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_productId_idx" ON "ziledigital"."DesignEntitlement"("productId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_userDesignId_idx" ON "ziledigital"."DesignEntitlement"("userDesignId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_purchasedDesignId_idx" ON "ziledigital"."DesignEntitlement"("purchasedDesignId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_orderItemId_idx" ON "ziledigital"."DesignEntitlement"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignUsage_idempotencyKey_key" ON "ziledigital"."DesignUsage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DesignUsage_entitlementId_idx" ON "ziledigital"."DesignUsage"("entitlementId");

-- CreateIndex
CREATE INDEX "DesignUsage_userId_idx" ON "ziledigital"."DesignUsage"("userId");

-- CreateIndex
CREATE INDEX "DesignUsage_guestId_idx" ON "ziledigital"."DesignUsage"("guestId");

-- CreateIndex
CREATE INDEX "DesignUsage_productId_idx" ON "ziledigital"."DesignUsage"("productId");

-- AddForeignKey
ALTER TABLE "ziledigital"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ziledigital"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_userDesignId_fkey" FOREIGN KEY ("userDesignId") REFERENCES "ziledigital"."UserDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_purchasedDesignId_fkey" FOREIGN KEY ("purchasedDesignId") REFERENCES "ziledigital"."PurchasedDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."DesignUsage" ADD CONSTRAINT "DesignUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ziledigital"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."DesignUsage" ADD CONSTRAINT "DesignUsage_userDesignId_fkey" FOREIGN KEY ("userDesignId") REFERENCES "ziledigital"."UserDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."DesignUsage" ADD CONSTRAINT "DesignUsage_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "ziledigital"."DesignEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
