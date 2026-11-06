-- CANONICAL_SCHEMA_SHA256 2fcdb3d8d06f0281fe1324eb33988b33b0069c739160bf618460ee562fe2656a
-- CANONICAL_CHECKS_SHA256 1bc47f8d6eb53b47549c6eb523f61a7714c52ec9e80cb50a6ca18fedc61e5cca
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ziledigital";

SET search_path TO "ziledigital", pg_catalog;

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "StoreRole" AS ENUM ('MANAGER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FulfillmentKind" AS ENUM ('PHYSICAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "InventoryPolicy" AS ENUM ('TRACKED', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLING', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CheckoutAttemptStatus" AS ENUM ('PREPARED', 'SESSION_CREATING', 'SESSION_CREATED', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "StockHoldStatus" AS ENUM ('HELD', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "Storefront" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "theme" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Storefront_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreMember" (
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("organizationId","storeId","userId")
);

-- CreateTable
CREATE TABLE "StoreDomain" (
    "hostname" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreDomain_pkey" PRIMARY KEY ("hostname")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("organizationId","productId","categoryId")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "attributes" JSONB,
    "fulfillment" "FulfillmentKind" NOT NULL,
    "inventoryPolicy" "InventoryPolicy" NOT NULL DEFAULT 'UNLIMITED',
    "priceMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreListing" (
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreListing_pkey" PRIMARY KEY ("organizationId","storeId","productId")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT,
    "private" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("organizationId","productId","assetId")
);

-- CreateTable
CREATE TABLE "DigitalFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLevel" (
    "organizationId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLevel_pkey" PRIMARY KEY ("organizationId","variantId","locationId")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT,
    "guestTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" VARCHAR(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "shippingMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "shippingAddress" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "fulfillment" "FulfillmentKind" NOT NULL,
    "attributesSnapshot" JSONB,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccount" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "organizationId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("organizationId","shipmentId","orderItemId")
);

-- CreateTable
CREATE TABLE "OrderDigitalFile" (
    "organizationId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "digitalFileId" TEXT NOT NULL,

    CONSTRAINT "OrderDigitalFile_pkey" PRIMARY KEY ("organizationId","orderItemId","digitalFileId")
);

-- CreateTable
CREATE TABLE "DigitalGrant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "digitalFileId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maximumUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DigitalGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountRef" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "capabilities" TEXT[],
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "failureCode" TEXT,

    CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "status" "CheckoutAttemptStatus" NOT NULL DEFAULT 'PREPARED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "providerSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockHold" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockHoldStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestPurchaseClaim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestPurchaseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Storefront_organizationId_slug_key" ON "Storefront"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Storefront_organizationId_id_key" ON "Storefront"("organizationId", "id");

-- CreateIndex
CREATE INDEX "StoreMember_userId_idx" ON "StoreMember"("userId");

-- CreateIndex
CREATE INDEX "StoreDomain_organizationId_storeId_idx" ON "StoreDomain"("organizationId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_slug_key" ON "Category"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_id_key" ON "Category"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Product_organizationId_status_idx" ON "Product"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_id_key" ON "Product"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ProductVariant_organizationId_productId_idx" ON "ProductVariant"("organizationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_organizationId_sku_key" ON "ProductVariant"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_organizationId_id_key" ON "ProductVariant"("organizationId", "id");

-- CreateIndex
CREATE INDEX "StoreListing_organizationId_productId_idx" ON "StoreListing"("organizationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_organizationId_storeId_slug_key" ON "StoreListing"("organizationId", "storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_organizationId_id_key" ON "MediaAsset"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalFile_organizationId_id_key" ON "DigitalFile"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalFile_organizationId_variantId_assetId_key" ON "DigitalFile"("organizationId", "variantId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_organizationId_id_key" ON "InventoryLocation"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_organizationId_name_key" ON "InventoryLocation"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_id_key" ON "Customer"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_email_key" ON "Customer"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_guestTokenHash_key" ON "Cart"("guestTokenHash");

-- CreateIndex
CREATE INDEX "Cart_organizationId_storeId_idx" ON "Cart"("organizationId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_organizationId_id_key" ON "Cart"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_organizationId_cartId_variantId_key" ON "CartItem"("organizationId", "cartId", "variantId");

-- CreateIndex
CREATE INDEX "Order_organizationId_storeId_createdAt_idx" ON "Order"("organizationId", "storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_id_key" ON "Order"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_storeId_id_key" ON "Order"("organizationId", "storeId", "id");

-- CreateIndex
CREATE INDEX "OrderItem_organizationId_orderId_idx" ON "OrderItem"("organizationId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_organizationId_id_key" ON "OrderItem"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Payment_organizationId_orderId_idx" ON "Payment"("organizationId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_provider_providerAccount_providerPay_key" ON "Payment"("organizationId", "provider", "providerAccount", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_organizationId_id_key" ON "Shipment"("organizationId", "id");

-- CreateIndex
CREATE INDEX "OrderDigitalFile_organizationId_digitalFileId_idx" ON "OrderDigitalFile"("organizationId", "digitalFileId");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalGrant_tokenHash_key" ON "DigitalGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "DigitalGrant_organizationId_orderItemId_idx" ON "DigitalGrant"("organizationId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalGrant_organizationId_orderItemId_digitalFileId_key" ON "DigitalGrant"("organizationId", "orderItemId", "digitalFileId");

-- CreateIndex
CREATE INDEX "Review_organizationId_storeId_productId_idx" ON "Review"("organizationId", "storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_organizationId_orderItemId_key" ON "Review"("organizationId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_organizationId_id_key" ON "IntegrationConnection"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_organizationId_provider_accountRef_key" ON "IntegrationConnection"("organizationId", "provider", "accountRef");

-- CreateIndex
CREATE INDEX "ProviderEvent_status_receivedAt_idx" ON "ProviderEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEvent_provider_providerEventId_key" ON "ProviderEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "MerchantAuditLog_organizationId_createdAt_idx" ON "MerchantAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_status_expiresAt_idx" ON "CheckoutAttempt"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_organizationId_storeId_idempotencyKeyHash_key" ON "CheckoutAttempt"("organizationId", "storeId", "idempotencyKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_organizationId_providerSessionId_key" ON "CheckoutAttempt"("organizationId", "providerSessionId");

-- CreateIndex
CREATE INDEX "StockHold_status_expiresAt_idx" ON "StockHold"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockHold_organizationId_orderItemId_locationId_key" ON "StockHold"("organizationId", "orderItemId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestPurchaseClaim_tokenHash_key" ON "GuestPurchaseClaim"("tokenHash");

-- CreateIndex
CREATE INDEX "GuestPurchaseClaim_requesterUserId_createdAt_idx" ON "GuestPurchaseClaim"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "GuestPurchaseClaim_organizationId_storeId_orderId_createdAt_idx" ON "GuestPurchaseClaim"("organizationId", "storeId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "GuestPurchaseClaim_expiresAt_idx" ON "GuestPurchaseClaim"("expiresAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storefront" ADD CONSTRAINT "Storefront_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDomain" ADD CONSTRAINT "StoreDomain_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_organizationId_categoryId_fkey" FOREIGN KEY ("organizationId", "categoryId") REFERENCES "Category"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_organizationId_assetId_fkey" FOREIGN KEY ("organizationId", "assetId") REFERENCES "MediaAsset"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_organizationId_variantId_fkey" FOREIGN KEY ("organizationId", "variantId") REFERENCES "ProductVariant"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_organizationId_assetId_fkey" FOREIGN KEY ("organizationId", "assetId") REFERENCES "MediaAsset"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_organizationId_variantId_fkey" FOREIGN KEY ("organizationId", "variantId") REFERENCES "ProductVariant"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_organizationId_locationId_fkey" FOREIGN KEY ("organizationId", "locationId") REFERENCES "InventoryLocation"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_organizationId_cartId_fkey" FOREIGN KEY ("organizationId", "cartId") REFERENCES "Cart"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_organizationId_variantId_fkey" FOREIGN KEY ("organizationId", "variantId") REFERENCES "ProductVariant"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_organizationId_orderId_fkey" FOREIGN KEY ("organizationId", "orderId") REFERENCES "Order"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_organizationId_variantId_fkey" FOREIGN KEY ("organizationId", "variantId") REFERENCES "ProductVariant"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_orderId_fkey" FOREIGN KEY ("organizationId", "orderId") REFERENCES "Order"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_organizationId_storeId_orderId_fkey" FOREIGN KEY ("organizationId", "storeId", "orderId") REFERENCES "Order"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_organizationId_shipmentId_fkey" FOREIGN KEY ("organizationId", "shipmentId") REFERENCES "Shipment"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_organizationId_orderItemId_fkey" FOREIGN KEY ("organizationId", "orderItemId") REFERENCES "OrderItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDigitalFile" ADD CONSTRAINT "OrderDigitalFile_organizationId_orderItemId_fkey" FOREIGN KEY ("organizationId", "orderItemId") REFERENCES "OrderItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDigitalFile" ADD CONSTRAINT "OrderDigitalFile_organizationId_digitalFileId_fkey" FOREIGN KEY ("organizationId", "digitalFileId") REFERENCES "DigitalFile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalGrant" ADD CONSTRAINT "DigitalGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalGrant" ADD CONSTRAINT "DigitalGrant_organizationId_orderItemId_fkey" FOREIGN KEY ("organizationId", "orderItemId") REFERENCES "OrderItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalGrant" ADD CONSTRAINT "DigitalGrant_organizationId_digitalFileId_fkey" FOREIGN KEY ("organizationId", "digitalFileId") REFERENCES "DigitalFile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_orderItemId_fkey" FOREIGN KEY ("organizationId", "orderItemId") REFERENCES "OrderItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId") REFERENCES "StoreListing"("organizationId", "storeId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEvent" ADD CONSTRAINT "ProviderEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAuditLog" ADD CONSTRAINT "MerchantAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_organizationId_storeId_orderId_fkey" FOREIGN KEY ("organizationId", "storeId", "orderId") REFERENCES "Order"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_organizationId_connectionId_fkey" FOREIGN KEY ("organizationId", "connectionId") REFERENCES "IntegrationConnection"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHold" ADD CONSTRAINT "StockHold_organizationId_orderItemId_fkey" FOREIGN KEY ("organizationId", "orderItemId") REFERENCES "OrderItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHold" ADD CONSTRAINT "StockHold_organizationId_variantId_locationId_fkey" FOREIGN KEY ("organizationId", "variantId", "locationId") REFERENCES "InventoryLevel"("organizationId", "variantId", "locationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPurchaseClaim" ADD CONSTRAINT "GuestPurchaseClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPurchaseClaim" ADD CONSTRAINT "GuestPurchaseClaim_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Storefront"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPurchaseClaim" ADD CONSTRAINT "GuestPurchaseClaim_organizationId_storeId_orderId_fkey" FOREIGN KEY ("organizationId", "storeId", "orderId") REFERENCES "Order"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPurchaseClaim" ADD CONSTRAINT "GuestPurchaseClaim_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPurchaseClaim" ADD CONSTRAINT "GuestPurchaseClaim_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canonical database invariants
-- Review and append these constraints to the generated fresh initial migration.
-- DO NOT apply to the old schema. This file is not auto-executed.
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_priceMinor_nonnegative" CHECK ("priceMinor" >= 0);
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_nonnegative" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amount_valid" CHECK ("quantity" > 0 AND "unitPriceMinor" >= 0 AND "totalMinor" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amount_valid" CHECK ("subtotalMinor" >= 0 AND "taxMinor" >= 0 AND "shippingMinor" >= 0 AND "totalMinor" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "DigitalGrant" ADD CONSTRAINT "DigitalGrant_uses_valid" CHECK ("uses" >= 0 AND ("maximumUses" IS NULL OR "maximumUses" >= 0));
-- Order and payment totals additionally require transaction-time service checks and reconciliation.
