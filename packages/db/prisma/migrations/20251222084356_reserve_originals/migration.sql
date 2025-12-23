-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "reservedOrderId" TEXT,
ADD COLUMN     "reservedUntil" TIMESTAMP(3);
