/*
  Warnings:

  - A unique constraint covering the columns `[productId,url]` on the table `ProductAsset` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductAsset_productId_url_key" ON "ziledigital"."ProductAsset"("productId", "url");
