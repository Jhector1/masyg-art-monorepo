-- AlterTable
ALTER TABLE "ziledigital"."OrderItem" ADD COLUMN     "previewUrlSnapshot" TEXT;

-- CreateTable
CREATE TABLE "ziledigital"."PurchasedDesign" (
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
CREATE UNIQUE INDEX "PurchasedDesign_orderItemId_key" ON "ziledigital"."PurchasedDesign"("orderItemId");

-- CreateIndex
CREATE INDEX "PurchasedDesign_userId_idx" ON "ziledigital"."PurchasedDesign"("userId");

-- CreateIndex
CREATE INDEX "PurchasedDesign_productId_idx" ON "ziledigital"."PurchasedDesign"("productId");

-- CreateIndex
CREATE INDEX "PurchasedDesign_orderId_idx" ON "ziledigital"."PurchasedDesign"("orderId");

-- AddForeignKey
ALTER TABLE "ziledigital"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ziledigital"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "ziledigital"."OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."PurchasedDesign" ADD CONSTRAINT "PurchasedDesign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ziledigital"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
