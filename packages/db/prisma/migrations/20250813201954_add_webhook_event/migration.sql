-- AlterTable
ALTER TABLE "ziledigital"."ProductVariant" ALTER COLUMN "format" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ziledigital"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
