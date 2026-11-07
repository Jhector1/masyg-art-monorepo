import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { CommerceInvariantError } from "./commerce-invariants";
import {
  assertRefundMatchesPayment,
  summarizeVerifiedRefunds,
  type RefundJournalEntry,
  type RefundPaymentScope,
} from "./partial-refund-policy";

/** Trusted internal evidence. Only a signature-verified TEST Connect event, followed
 * by authoritative Stripe Charge, PaymentIntent and complete refund-list retrieval,
 * may construct this snapshot. Never accept these fields from a buyer request.
 *
 * Every provider refund on the charge (including failed/pending ones) must appear;
 * a truncated page is a fatal reconciliation error, not a partial snapshot.
 */
export type VerifiedStripeRefundSnapshot = {
  eventId: string;
  providerAccount: string;
  paymentIntentId: string;
  chargeId: string;
  organizationId: string;
  storeId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  refunds: ReadonlyArray<{
    providerRefundId: string;
    amountMinor: number;
    currency: string;
    status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  }>;
};

function invalid(message: string): never {
  throw new CommerceInvariantError("REFUND_JOURNAL_CONFLICT", message);
}

function validateEnvelope(e: VerifiedStripeRefundSnapshot): void {
  if (!e || !/^evt_[A-Za-z0-9_]{6,}$/.test(e.eventId) ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(e.providerAccount) ||
      !/^pi_[A-Za-z0-9_]+$/.test(e.paymentIntentId) ||
      !/^ch_[A-Za-z0-9_]+$/.test(e.chargeId) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(e.organizationId) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(e.storeId) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(e.orderId) ||
      !Number.isSafeInteger(e.amountMinor) || e.amountMinor <= 0 || e.amountMinor > 2147483647 ||
      !/^[A-Z]{3}$/.test(e.currency) || !Array.isArray(e.refunds) ||
      e.refunds.length === 0 || e.refunds.length > 2000) {
    invalid("Incomplete or malformed provider refund snapshot");
  }
}

const selectedPayment = {
  id: true,
  organizationId: true,
  orderId: true,
  provider: true,
  providerAccount: true,
  providerPaymentId: true,
  amountMinor: true,
  currency: true,
  status: true,
  order: {select: {
    id: true,
    organizationId: true,
    storeId: true,
    status: true,
    currency: true,
    totalMinor: true,
  }},
} satisfies Prisma.PaymentSelect;

/** Serializable journal reconciliation. A successful *partial* refund changes neither
 * the order/payment status nor download entitlements. Full success changes both and
 * revokes grants once, in the same DB transaction as refund rows and event recording.
 * Stock is never restocked here.
 */
export async function settleVerifiedStripeRefundSnapshot(e: VerifiedStripeRefundSnapshot) {
  validateEnvelope(e);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const payment = await tx.payment.findFirst({
          where: {
            organizationId: e.organizationId,
            orderId: e.orderId,
            provider: "stripe",
            providerAccount: e.providerAccount,
            providerPaymentId: e.paymentIntentId,
            amountMinor: e.amountMinor,
            currency: e.currency,
          },
          select: selectedPayment,
        });
        if (!payment || payment.order.id !== e.orderId ||
            payment.order.organizationId !== e.organizationId ||
            payment.order.storeId !== e.storeId ||
            payment.order.currency !== e.currency ||
            payment.order.totalMinor !== e.amountMinor ||
            !["SUCCEEDED", "REFUNDED"].includes(payment.status) ||
            !["PAID", "FULFILLING", "FULFILLED", "REFUNDED"].includes(payment.order.status)) {
          throw new CommerceInvariantError("REFUND_OWNER_MISMATCH", "Refund does not match a settled merchant order");
        }

        const priorEvent = await tx.providerEvent.findUnique({
          where: {provider_providerEventId: {provider: "stripe", providerEventId: e.eventId}},
          select: {organizationId: true, status: true},
        });
        if (priorEvent && (priorEvent.organizationId !== e.organizationId || priorEvent.status !== "PROCESSED")) {
          invalid("Provider event is not replayable for this organization");
        }

        const scope: RefundPaymentScope = {
          organizationId: payment.organizationId,
          paymentId: payment.id,
          provider: "stripe",
          providerAccount: payment.providerAccount,
          providerChargeId: e.chargeId,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
        };
        const snapshot: RefundJournalEntry[] = e.refunds.map(refund => ({
          organizationId: payment.organizationId,
          paymentId: payment.id,
          provider: "stripe",
          providerAccount: payment.providerAccount,
          providerChargeId: e.chargeId,
          providerRefundId: refund.providerRefundId,
          amountMinor: refund.amountMinor,
          currency: refund.currency,
          status: refund.status,
        }));
        for (const refund of snapshot) assertRefundMatchesPayment(scope, refund);
        const totals = summarizeVerifiedRefunds(scope, snapshot);
        const existing = await tx.paymentRefund.findMany({
          where: {organizationId: payment.organizationId, paymentId: payment.id},
          select: {
            organizationId: true, paymentId: true, provider: true,
            providerAccount: true, providerChargeId: true, providerRefundId: true,
            amountMinor: true, currency: true, status: true,
          },
        });
        const providerRows = new Map(snapshot.map(row => [row.providerRefundId, row]));
        const currentRows = new Map(existing.map(row => [row.providerRefundId, row]));
        if (existing.length > snapshot.length) invalid("Provider refund snapshot omits a recorded refund");
        for (const row of existing) {
          if (row.provider !== "stripe") invalid("Refund provider identity mismatch");
          assertRefundMatchesPayment(scope, {...row, provider: "stripe"});
          const next = providerRows.get(row.providerRefundId);
          if (!next || row.amountMinor !== next.amountMinor || row.currency !== next.currency ||
              row.providerChargeId !== next.providerChargeId ||
              (row.status === "SUCCEEDED" && next.status !== "SUCCEEDED") ||
              (["FAILED", "CANCELED"].includes(row.status) && row.status !== next.status)) {
            invalid("Refund history changed or provider snapshot regressed");
          }
        }

        if (payment.status === "REFUNDED" || payment.order.status === "REFUNDED") {
          if (payment.status !== "REFUNDED" || payment.order.status !== "REFUNDED" || !totals.fullyRefunded) {
            invalid("Finalized order is inconsistent with refund totals");
          }
        }
        const date = new Date();
        for (const refund of snapshot) {
          const current = currentRows.get(refund.providerRefundId);
          if (current) {
            if (current.status !== refund.status) {
              const changed = await tx.paymentRefund.updateMany({
                where: {
                  organizationId: e.organizationId, paymentId: payment.id,
                  provider: "stripe", providerAccount: e.providerAccount,
                  providerRefundId: refund.providerRefundId, status: current.status,
                  amountMinor: refund.amountMinor, currency: refund.currency,
                  providerChargeId: e.chargeId,
                },
                data: {status: refund.status},
              });
              if (changed.count !== 1) invalid("Concurrent refund status update");
            }
          } else {
            // The global unique refund ID also prevents another tenant/payment from
            // adopting this refund. A racing insert is retried by the outer loop.
            await tx.paymentRefund.create({data: refund});
          }
        }

        let finalized = false;
        if (totals.fullyRefunded && payment.status === "SUCCEEDED") {
          if (!["PAID", "FULFILLING", "FULFILLED"].includes(payment.order.status)) {
            invalid("Order cannot be finalized from its current state");
          }
          const updated = await tx.payment.updateMany({
            where: {id: payment.id, organizationId: e.organizationId, status: "SUCCEEDED"},
            data: {status: "REFUNDED"},
          });
          const order = await tx.order.updateMany({
            where: {id: e.orderId, organizationId: e.organizationId, storeId: e.storeId,
              status: {in: ["PAID", "FULFILLING", "FULFILLED"]}},
            data: {status: "REFUNDED"},
          });
          if (updated.count !== 1 || order.count !== 1) invalid("Concurrent order refund transition");
          await tx.digitalGrant.updateMany({
            where: {organizationId: e.organizationId, item: {orderId: e.orderId}, revokedAt: null},
            data: {revokedAt: date},
          });
          finalized = true;
        }
        if (!priorEvent) {
          await tx.providerEvent.create({data: {
            organizationId: e.organizationId,
            provider: "stripe",
            providerEventId: e.eventId,
            status: "PROCESSED",
            attempts: 1,
            processedAt: date,
          }});
        }
        return {
          status: totals.fullyRefunded ? "REFUNDED" as const :
            totals.partiallyRefunded ? "PARTIALLY_REFUNDED" as const :
              totals.pendingMinor > 0 ? "REFUND_PENDING" as const : "REFUND_RECORDED" as const,
          succeededMinor: totals.succeededMinor,
          pendingMinor: totals.pendingMinor,
          replay: Boolean(priorEvent) || (totals.fullyRefunded && !finalized),
        };
      }, {isolationLevel: "Serializable", timeout: 12000});
    } catch (error) {
      if (attempt === 2 || !["P2002", "P2034"].includes((error as {code?: string})?.code ?? "")) {
        throw error;
      }
    }
  }
  invalid("Refund transaction retry budget exhausted");
}
