-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutExpiresAt" TIMESTAMP(3),
ADD COLUMN     "stripeSessionUrl" TEXT;
