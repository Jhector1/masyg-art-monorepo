-- CreateEnum
CREATE TYPE "public"."CldResourceType" AS ENUM ('image', 'raw', 'video');

-- CreateEnum
CREATE TYPE "public"."CldDeliveryType" AS ENUM ('upload', 'authenticated', 'private');

-- AlterTable
ALTER TABLE "public"."ProductAsset" ADD COLUMN     "deliveryType" "public"."CldDeliveryType",
ADD COLUMN     "resourceType" "public"."CldResourceType";
