/*
  Warnings:

  - A unique constraint covering the columns `[printfulVariantId]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_printfulVariantId_key" ON "ProductVariant"("printfulVariantId");
