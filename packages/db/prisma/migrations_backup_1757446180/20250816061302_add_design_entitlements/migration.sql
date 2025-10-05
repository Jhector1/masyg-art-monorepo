/*
  Warnings:

  - You are about to drop the column `editQuota` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `editsUsed` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `exportQuota` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `exportsUsed` on the `UserDesign` table. All the data in the column will be lost.
  - You are about to drop the column `purchased` on the `UserDesign` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."EntitlementSource" AS ENUM ('PURCHASE', 'TOPUP', 'GRANT');

-- CreateEnum
CREATE TYPE "public"."UsageKind" AS ENUM ('EXPORT', 'EDIT');

-- AlterTable
ALTER TABLE "public"."UserDesign" DROP COLUMN "editQuota",
DROP COLUMN "editsUsed",
DROP COLUMN "exportQuota",
DROP COLUMN "exportsUsed",
DROP COLUMN "purchased";

-- CreateTable
CREATE TABLE "public"."DesignEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "productId" TEXT NOT NULL,
    "userDesignId" TEXT,
    "purchasedDesignId" TEXT,
    "source" "public"."EntitlementSource" NOT NULL,
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
CREATE TABLE "public"."DesignUsage" (
    "id" TEXT NOT NULL,
    "kind" "public"."UsageKind" NOT NULL,
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
CREATE INDEX "DesignEntitlement_userId_idx" ON "public"."DesignEntitlement"("userId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_guestId_idx" ON "public"."DesignEntitlement"("guestId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_productId_idx" ON "public"."DesignEntitlement"("productId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_userDesignId_idx" ON "public"."DesignEntitlement"("userDesignId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_purchasedDesignId_idx" ON "public"."DesignEntitlement"("purchasedDesignId");

-- CreateIndex
CREATE INDEX "DesignEntitlement_orderItemId_idx" ON "public"."DesignEntitlement"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignUsage_idempotencyKey_key" ON "public"."DesignUsage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DesignUsage_entitlementId_idx" ON "public"."DesignUsage"("entitlementId");

-- CreateIndex
CREATE INDEX "DesignUsage_userId_idx" ON "public"."DesignUsage"("userId");

-- CreateIndex
CREATE INDEX "DesignUsage_guestId_idx" ON "public"."DesignUsage"("guestId");

-- CreateIndex
CREATE INDEX "DesignUsage_productId_idx" ON "public"."DesignUsage"("productId");

-- AddForeignKey
ALTER TABLE "public"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_userDesignId_fkey" FOREIGN KEY ("userDesignId") REFERENCES "public"."UserDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignEntitlement" ADD CONSTRAINT "DesignEntitlement_purchasedDesignId_fkey" FOREIGN KEY ("purchasedDesignId") REFERENCES "public"."PurchasedDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignUsage" ADD CONSTRAINT "DesignUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignUsage" ADD CONSTRAINT "DesignUsage_userDesignId_fkey" FOREIGN KEY ("userDesignId") REFERENCES "public"."UserDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignUsage" ADD CONSTRAINT "DesignUsage_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "public"."DesignEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
