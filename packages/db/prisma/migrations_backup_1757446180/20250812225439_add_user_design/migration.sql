-- AlterTable
ALTER TABLE "public"."CartItem" ADD COLUMN     "designId" TEXT,
ADD COLUMN     "previewUrlSnapshot" VARCHAR(2000),
ADD COLUMN     "styleSnapshot" JSONB;

-- AlterTable
ALTER TABLE "public"."UserDesign" ADD COLUMN     "previewPublicId" VARCHAR(255),
ADD COLUMN     "previewUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "previewUrl" VARCHAR(2000);

-- CreateIndex
CREATE INDEX "CartItem_designId_idx" ON "public"."CartItem"("designId");

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_designId_fkey" FOREIGN KEY ("designId") REFERENCES "public"."UserDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
