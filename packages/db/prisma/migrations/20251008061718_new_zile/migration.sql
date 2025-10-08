/*
  Warnings:

  - You are about to drop the column `ziledigitalId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `avatarziledigitalId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `previewziledigitalId` on the `UserDesign` table. All the data in the column will be lost.
  - Added the required column `publicId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "ziledigitalId",
ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarziledigitalId",
ADD COLUMN     "avatarPublicId" VARCHAR(191);

-- AlterTable
ALTER TABLE "UserDesign" DROP COLUMN "previewziledigitalId",
ADD COLUMN     "previewPublicId" VARCHAR(255);
