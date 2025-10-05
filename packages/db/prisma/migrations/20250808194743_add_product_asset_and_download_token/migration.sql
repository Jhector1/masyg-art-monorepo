-- CreateTable
CREATE TABLE "public"."ProductAsset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageKey" TEXT,
    "url" TEXT NOT NULL,
    "previewUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "isVector" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "dpi" INTEGER,
    "colorProfile" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "pdfPageCount" INTEGER,
    "pdfPageWIn" DOUBLE PRECISION,
    "pdfPageHIn" DOUBLE PRECISION,
    "svgViewBox" TEXT,
    "hasAlpha" BOOLEAN,
    "isAnimated" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DownloadToken" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "userId" TEXT,
    "guestId" TEXT,
    "signedUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "remainingUses" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadedAt" TIMESTAMP(3),
    "licenseSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAsset_storageKey_key" ON "public"."ProductAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAsset_url_key" ON "public"."ProductAsset"("url");

-- CreateIndex
CREATE INDEX "ProductAsset_productId_idx" ON "public"."ProductAsset"("productId");

-- CreateIndex
CREATE INDEX "DownloadToken_orderId_idx" ON "public"."DownloadToken"("orderId");

-- CreateIndex
CREATE INDEX "DownloadToken_assetId_idx" ON "public"."DownloadToken"("assetId");

-- CreateIndex
CREATE INDEX "DownloadToken_guestId_idx" ON "public"."DownloadToken"("guestId");

-- CreateIndex
CREATE INDEX "DownloadToken_orderId_assetId_idx" ON "public"."DownloadToken"("orderId", "assetId");

-- AddForeignKey
ALTER TABLE "public"."ProductAsset" ADD CONSTRAINT "ProductAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DownloadToken" ADD CONSTRAINT "DownloadToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DownloadToken" ADD CONSTRAINT "DownloadToken_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."ProductAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DownloadToken" ADD CONSTRAINT "DownloadToken_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DownloadToken" ADD CONSTRAINT "DownloadToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
