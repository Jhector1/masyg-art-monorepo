/*
  Warnings:

  - You are about to alter the column `originalPrice` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - The `svg` column on the `PurchasedDesign` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[sku]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[originalSerial]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."InventoryStatus" AS ENUM ('ACTIVE', 'RESERVED', 'SOLD');

-- AlterEnum
ALTER TYPE "public"."VariantType" ADD VALUE 'ORIGINAL';

-- AlterTable
ALTER TABLE "public"."CartItem" ADD COLUMN     "originalVariantId" TEXT,
ALTER COLUMN "originalPrice" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "originalVariantId" TEXT;

-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "depthIn" DOUBLE PRECISION,
ADD COLUMN     "framed" BOOLEAN DEFAULT false,
ADD COLUMN     "heightIn" DOUBLE PRECISION,
ADD COLUMN     "inventory" INTEGER DEFAULT 1,
ADD COLUMN     "listPrice" DOUBLE PRECISION,
ADD COLUMN     "medium" TEXT,
ADD COLUMN     "originalSerial" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "soldAt" TIMESTAMP(3),
ADD COLUMN     "status" "public"."InventoryStatus" DEFAULT 'ACTIVE',
ADD COLUMN     "surface" TEXT,
ADD COLUMN     "weightLb" DOUBLE PRECISION,
ADD COLUMN     "widthIn" DOUBLE PRECISION,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "public"."PurchasedDesign" DROP COLUMN "svg",
ADD COLUMN     "svg" JSONB;

-- CreateIndex
CREATE INDEX "CartItem_originalVariantId_idx" ON "public"."CartItem"("originalVariantId");

-- CreateIndex
CREATE INDEX "OrderItem_originalVariantId_idx" ON "public"."OrderItem"("originalVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "public"."ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_originalSerial_key" ON "public"."ProductVariant"("originalSerial");

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_originalVariantId_fkey" FOREIGN KEY ("originalVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_originalVariantId_fkey" FOREIGN KEY ("originalVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
