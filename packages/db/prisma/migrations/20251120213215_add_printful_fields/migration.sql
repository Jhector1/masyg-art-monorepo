/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FulfillmentProvider" AS ENUM ('INTERNAL', 'PRINTFUL');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "baseCost" DOUBLE PRECISION,
ADD COLUMN     "fulfillmentProvider" "FulfillmentProvider" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "printfulVariantId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalId_key" ON "Product"("externalId");
