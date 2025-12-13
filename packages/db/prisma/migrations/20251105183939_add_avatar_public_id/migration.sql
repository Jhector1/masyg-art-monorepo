/*
  Warnings:

  - You are about to drop the column `ziledigitalId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `avatarziledigitalId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `previewziledigitalId` on the `UserDesign` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[barcode]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[upc]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `publicId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('ART', 'STICKER', 'MUG', 'CARD', 'BOOK_DIGITAL', 'OTHER');

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "ziledigitalId",
ADD COLUMN     "isCustomizable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'ART',
ADD COLUMN     "optionSchema" JSONB,
ADD COLUMN     "publicId" TEXT NOT NULL,
ADD COLUMN     "requiresShipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "packQuantity" INTEGER,
ADD COLUMN     "requiresShipping" BOOLEAN,
ADD COLUMN     "upc" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarziledigitalId",
ADD COLUMN     "avatarPublicId" VARCHAR(191);

-- AlterTable
ALTER TABLE "UserDesign" DROP COLUMN "previewziledigitalId",
ADD COLUMN     "previewPublicId" VARCHAR(255);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "price" DOUBLE PRECISION,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleItem_bundleId_idx" ON "BundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "BundleItem_productId_idx" ON "BundleItem"("productId");

-- CreateIndex
CREATE INDEX "BundleItem_variantId_idx" ON "BundleItem"("variantId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_kind_idx" ON "Product"("kind");

-- CreateIndex
CREATE INDEX "Product_requiresShipping_idx" ON "Product"("requiresShipping");

-- CreateIndex
CREATE INDEX "Product_tags_idx" ON "Product" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_barcode_key" ON "ProductVariant"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_upc_key" ON "ProductVariant"("upc");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");

-- CreateIndex
CREATE INDEX "ProductVariant_listPrice_idx" ON "ProductVariant"("listPrice");

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
