-- CreateTable
CREATE TABLE "ziledigital"."UserDesign" (
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
CREATE INDEX "UserDesign_userId_idx" ON "ziledigital"."UserDesign"("userId");

-- CreateIndex
CREATE INDEX "UserDesign_guestId_idx" ON "ziledigital"."UserDesign"("guestId");

-- CreateIndex
CREATE INDEX "UserDesign_productId_idx" ON "ziledigital"."UserDesign"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDesign_userId_productId_key" ON "ziledigital"."UserDesign"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDesign_guestId_productId_key" ON "ziledigital"."UserDesign"("guestId", "productId");

-- AddForeignKey
ALTER TABLE "ziledigital"."UserDesign" ADD CONSTRAINT "UserDesign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ziledigital"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ziledigital"."UserDesign" ADD CONSTRAINT "UserDesign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ziledigital"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
