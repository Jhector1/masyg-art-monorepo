/*
  Warnings:

  - A unique constraint covering the columns `[userId,site]` on the table `Cart` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guestId,site]` on the table `Cart` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,productId,site]` on the table `Favorite` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guestId,productId,site]` on the table `Favorite` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Storefront" AS ENUM ('ZILEDIGITAL', 'JEANYVES');

-- DropIndex
DROP INDEX "Cart_guestId_idx";

-- DropIndex
DROP INDEX "Cart_guestId_key";

-- DropIndex
DROP INDEX "Cart_userId_key";

-- DropIndex
DROP INDEX "Favorite_guestId_productId_key";

-- DropIndex
DROP INDEX "Favorite_userId_productId_key";

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "site" "Storefront" NOT NULL DEFAULT 'ZILEDIGITAL';

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "site" "Storefront" NOT NULL DEFAULT 'ZILEDIGITAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "site" "Storefront" NOT NULL DEFAULT 'ZILEDIGITAL';

-- CreateIndex
CREATE INDEX "Cart_guestId_site_idx" ON "Cart"("guestId", "site");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_site_key" ON "Cart"("userId", "site");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_guestId_site_key" ON "Cart"("guestId", "site");

-- CreateIndex
CREATE INDEX "Favorite_userId_site_idx" ON "Favorite"("userId", "site");

-- CreateIndex
CREATE INDEX "Favorite_guestId_site_idx" ON "Favorite"("guestId", "site");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productId_site_key" ON "Favorite"("userId", "productId", "site");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_guestId_productId_site_key" ON "Favorite"("guestId", "productId", "site");

-- CreateIndex
CREATE INDEX "Order_site_idx" ON "Order"("site");
