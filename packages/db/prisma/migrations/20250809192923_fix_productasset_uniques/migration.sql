-- DropIndex
DROP INDEX "public"."ProductAsset_url_key";

-- CreateIndex
CREATE INDEX "ProductAsset_productId_idx" ON "public"."ProductAsset"("productId");

-- CreateIndex
CREATE INDEX "ProductAsset_url_idx" ON "public"."ProductAsset"("url");
