-- v36A: canonical buyer favorites; no legacy favorite table is recreated.
CREATE TABLE "ziledigital"."StoreFavorite" (
  "organizationId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreFavorite_pkey" PRIMARY KEY ("organizationId", "storeId", "userId", "productId"),
  CONSTRAINT "StoreFavorite_listing_fkey" FOREIGN KEY ("organizationId", "storeId", "productId")
    REFERENCES "ziledigital"."StoreListing"("organizationId", "storeId", "productId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreFavorite_user_fkey" FOREIGN KEY ("userId")
    REFERENCES "ziledigital"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StoreFavorite_userId_organizationId_storeId_idx"
  ON "ziledigital"."StoreFavorite"("userId", "organizationId", "storeId");
