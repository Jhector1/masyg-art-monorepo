-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "site" "Storefront" NOT NULL DEFAULT 'ZILEDIGITAL';

-- CreateIndex
CREATE INDEX "Product_site_idx" ON "Product"("site");

-- CreateIndex
CREATE INDEX "Product_site_categoryId_idx" ON "Product"("site", "categoryId");

-- CreateIndex
CREATE INDEX "Product_site_kind_idx" ON "Product"("site", "kind");
