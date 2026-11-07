-- v39D.6E.1: additive refund journal foundation.
-- No existing payment/order/grant status changes. No data deletions.
CREATE TYPE "RefundRecordStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- Supports composite tenant-scoped FK from the journal to its payment.
CREATE UNIQUE INDEX "Payment_organizationId_id_key" ON "Payment"("organizationId", "id");

CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccount" TEXT NOT NULL,
    "providerRefundId" TEXT NOT NULL,
    "providerChargeId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "RefundRecordStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRefund_provider_providerAccount_providerRefundId_key"
    ON "PaymentRefund"("provider", "providerAccount", "providerRefundId");

CREATE INDEX "PaymentRefund_organizationId_paymentId_status_idx"
    ON "PaymentRefund"("organizationId", "paymentId", "status");

ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_organizationId_paymentId_fkey"
    FOREIGN KEY ("organizationId", "paymentId") REFERENCES "Payment"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
