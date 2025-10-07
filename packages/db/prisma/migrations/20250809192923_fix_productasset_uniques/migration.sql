-- DropIndex
DROP INDEX "ziledigital"."ProductAsset_url_key";

-- CreateIndex
CREATE INDEX "ProductAsset_productId_idx" ON "ziledigital"."ProductAsset"("productId");

-- CreateIndex
CREATE INDEX "ProductAsset_url_idx" ON "ziledigital"."ProductAsset"("url");
