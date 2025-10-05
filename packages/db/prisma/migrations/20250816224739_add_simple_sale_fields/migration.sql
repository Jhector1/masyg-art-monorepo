-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "listPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "salePercent" INTEGER,
ADD COLUMN     "salePrice" DOUBLE PRECISION,
ADD COLUMN     "saleStartsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Product_saleStartsAt_saleEndsAt_idx" ON "public"."Product"("saleStartsAt", "saleEndsAt");

-- CreateIndex
CREATE INDEX "Product_saleEndsAt_idx" ON "public"."Product"("saleEndsAt");
