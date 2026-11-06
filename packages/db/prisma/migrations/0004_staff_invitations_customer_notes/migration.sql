-- v33 additive operational models. Does not mutate orders, payments, or old customer records.
CREATE TABLE "ziledigital"."StaffInvitation" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "email" VARCHAR(254) NOT NULL,
 "role" "ziledigital"."OrganizationRole" NOT NULL,
 "storeId" TEXT,
 "tokenHash" VARCHAR(64) NOT NULL,
 "activeKey" VARCHAR(400),
 "deliveryStatus" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
 "providerMessageId" TEXT,
 "createdByUserId" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "sentAt" TIMESTAMP(3),
 "acceptedAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StaffInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ziledigital"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "StaffInvitation_delivery_status_ck" CHECK ("deliveryStatus" IN ('PENDING','SENT','FAILED'))
);
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "ziledigital"."StaffInvitation"("tokenHash");
CREATE UNIQUE INDEX "StaffInvitation_activeKey_key" ON "ziledigital"."StaffInvitation"("activeKey");
CREATE INDEX "StaffInvitation_organizationId_createdAt_idx" ON "ziledigital"."StaffInvitation"("organizationId", "createdAt");
CREATE INDEX "StaffInvitation_organizationId_email_idx" ON "ziledigital"."StaffInvitation"("organizationId", "email");

CREATE TABLE "ziledigital"."CustomerNote" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "storeId" TEXT NOT NULL,
 "customerId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "body" VARCHAR(2000) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CustomerNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ziledigital"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CustomerNote_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "ziledigital"."Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CustomerNote_body_nonblank" CHECK (length(trim("body")) > 0)
);
CREATE INDEX "CustomerNote_organizationId_storeId_customerId_createdAt_idx" ON "ziledigital"."CustomerNote"("organizationId", "storeId", "customerId", "createdAt");

-- A request key makes manual shipment planning safe to retry without duplicating quantities.
ALTER TABLE "ziledigital"."Shipment" ADD COLUMN "planKey" VARCHAR(64), ADD COLUMN "planFingerprint" VARCHAR(64);
CREATE UNIQUE INDEX "Shipment_planKey_key" ON "ziledigital"."Shipment"("planKey");
