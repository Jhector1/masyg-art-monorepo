-- CreateTable
CREATE TABLE "public"."UserDesign" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "productId" TEXT NOT NULL,
    "style" JSONB NOT NULL,
    "defs" TEXT,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "exportQuota" INTEGER NOT NULL DEFAULT 0,
    "exportsUsed" INTEGER NOT NULL DEFAULT 0,
    "editQuota" INTEGER NOT NULL DEFAULT 0,
    "editsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDesign_userId_idx" ON "public"."UserDesign"("userId");

-- CreateIndex
CREATE INDEX "UserDesign_guestId_idx" ON "public"."UserDesign"("guestId");

-- CreateIndex
CREATE INDEX "UserDesign_productId_idx" ON "public"."UserDesign"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDesign_userId_productId_key" ON "public"."UserDesign"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDesign_guestId_productId_key" ON "public"."UserDesign"("guestId", "productId");

-- AddForeignKey
ALTER TABLE "public"."UserDesign" ADD CONSTRAINT "UserDesign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserDesign" ADD CONSTRAINT "UserDesign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
