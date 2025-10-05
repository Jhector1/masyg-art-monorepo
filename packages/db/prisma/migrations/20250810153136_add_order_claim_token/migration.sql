/*
  Warnings:

  - A unique constraint covering the columns `[claimTokenHash]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "claimTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "claimTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_claimTokenHash_key" ON "public"."Order"("claimTokenHash");

-- CreateIndex
CREATE INDEX "Order_claimTokenExpiresAt_idx" ON "public"."Order"("claimTokenExpiresAt");
