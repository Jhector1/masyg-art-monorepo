-- AlterTable
ALTER TABLE "ziledigital"."CartItem" ADD COLUMN     "designId" TEXT,
ADD COLUMN     "previewUrlSnapshot" VARCHAR(2000),
ADD COLUMN     "styleSnapshot" JSONB;

-- AlterTable
ALTER TABLE "ziledigital"."UserDesign" ADD COLUMN     "previewziledigitalId" VARCHAR(255),
ADD COLUMN     "previewUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "previewUrl" VARCHAR(2000);

-- CreateIndex
CREATE INDEX "CartItem_designId_idx" ON "ziledigital"."CartItem"("designId");

-- AddForeignKey
ALTER TABLE "ziledigital"."CartItem" ADD CONSTRAINT "CartItem_designId_fkey" FOREIGN KEY ("designId") REFERENCES "ziledigital"."UserDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
