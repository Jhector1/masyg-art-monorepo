-- CreateEnum
CREATE TYPE "ziledigital"."CldResourceType" AS ENUM ('image', 'raw', 'video');

-- CreateEnum
CREATE TYPE "ziledigital"."CldDeliveryType" AS ENUM ('upload', 'authenticated', 'private');

-- AlterTable
ALTER TABLE "ziledigital"."ProductAsset" ADD COLUMN     "deliveryType" "ziledigital"."CldDeliveryType",
ADD COLUMN     "resourceType" "ziledigital"."CldResourceType";
