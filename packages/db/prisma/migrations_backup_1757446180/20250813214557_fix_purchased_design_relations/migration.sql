-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "previewUrlSnapshot" TEXT;

-- CreateTable
CREATE TABLE "public"."PurchasedDesign" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "style" JSONB NOT NULL,
    "defs" TEXT,
    "svg" TEXT,
    "previewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasedDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchasedDesign_orderItemId_key" ON "public"."PurchasedDesign"("orderItemId");

-- CreateIndex
CREATE INDEX "PurchasedDesign_userId_idx" ON "public"."PurchasedDesign"("userId");

-- CreateIndex
CREATE INDEX "PurchasedDesign_productId_idx" ON "public"."PurchasedDesign"("productId");

-- CreateIndex
CREATE INDEX "PurchasedDesign_orderId_idx" ON "public"."PurchasedDesign"("orderId");

-- AddForeignKey
ALTER TABLE "public"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
