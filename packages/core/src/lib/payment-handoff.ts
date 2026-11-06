import { createHash } from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { assertPaymentConnection, CommerceInvariantError } from "./commerce-invariants";
import { validateTenantId } from "./tenancy";

/**
 * Internal, provider-neutral payment handoff. Deliberately NOT exposed by HTTP routes.
 * All arguments are resolved by trusted server components, never directly from buyer JSON.
 * This module cannot create or verify a provider payment, grant downloads, or mark an order paid.
 */
export type PaymentHandoffRef = {
  organizationId: string;
  storeId: string;
  attemptId: string;
};

export type ProviderCheckoutReceipt = {
  // Read from the payment provider via a trusted server-side adapter, not client-controlled input.
  provider: string;
  providerAccount: string;
  sessionId: string;
  operationKey: string;
  amountMinor: number;
  currency: string;
  expiresAt: Date;
};

/** Provider adapter uses this SAME deterministic key during retries and process restarts.
 * The key is unique for an attempt AND the merchant's connection. Provider API key retention
 * is provider-dependent; never retry indefinitely after that window has elapsed.
 */
export function providerSessionOperationKey(attemptId: string, connectionId: string): string {
  const attempt = validateTenantId(attemptId);
  const conn = validateTenantId(connectionId);
  return createHash("sha256").update(`ziledigital:checkout-session:v1:${conn}:${attempt}`).digest("hex");
}

const attemptSelect = {
  id: true, organizationId: true, storeId: true, orderId: true,
  connectionId: true, status: true, providerSessionId: true,
  expiresAt: true, createdAt: true,
  connection: {select: {
    id: true, organizationId: true, provider: true, accountRef: true, secretRef: true,
    status: true, verifiedAt: true, capabilities: true,
  }},
  order: {select: {
    id: true, organizationId: true, storeId: true, status: true,
    currency: true, subtotalMinor: true, taxMinor: true,
    shippingMinor: true, totalMinor: true,
  }},
} satisfies Prisma.CheckoutAttemptSelect;

type AttemptData = Prisma.CheckoutAttemptGetPayload<{select: typeof attemptSelect}>;

function positiveOrderTotal(order: AttemptData["order"]): void {
  const {subtotalMinor, taxMinor, shippingMinor, totalMinor, currency} = order;
  if (!/^[A-Z]{3}$/.test(currency) ||
      ![subtotalMinor, taxMinor, shippingMinor, totalMinor].every(n =>
        Number.isSafeInteger(n) && n >= 0 && n <= 2_147_483_647) ||
      totalMinor <= 0 || subtotalMinor + taxMinor + shippingMinor !== totalMinor) {
    throw new CommerceInvariantError("INVALID_ORDER", "Order total or currency is inconsistent");
  }
}

function enforceOwner(attempt: AttemptData, ref: PaymentHandoffRef): void {
  if (attempt.organizationId !== ref.organizationId ||
      attempt.storeId !== ref.storeId ||
      attempt.order.organizationId !== ref.organizationId ||
      attempt.order.storeId !== ref.storeId ||
      attempt.connection.organizationId !== ref.organizationId ||
      attempt.connection.id !== attempt.connectionId ||
      attempt.order.id !== attempt.orderId) {
    throw new CommerceInvariantError("TENANT_MISMATCH", "Checkout does not belong to this merchant and store");
  }
  assertPaymentConnection(ref.organizationId, attempt.connection);
  positiveOrderTotal(attempt.order);
}

function ensurePending(attempt: AttemptData): void {
  if (attempt.order.status !== "PENDING") {
    throw new CommerceInvariantError("ORDER_STATE_CONFLICT", "Only an unpaid pending order can open a checkout session");
  }
  if (!(["PREPARED", "SESSION_CREATING", "SESSION_CREATED"] as string[]).includes(attempt.status)) {
    throw new CommerceInvariantError("CHECKOUT_CLOSED", "Checkout has already been finalized");
  }
}

// This is long enough for Stripe's documented minimum 30-minute Checkout Session,
// with room for provider request latency. The provider receipt MUST expire no later
// than this hold. It is NOT a command to automatically release session-created stock.
const SESSION_HOLD_MINUTES = 45;
const MAX_CLAIM_AGE_MS = 15 * 60 * 1000; // at claim time, prepared-attempt TTL is 15 minutes

async function withSerializableRetry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await prisma.$transaction(work, {isolationLevel: "Serializable", timeout: 12000});
    } catch (error) {
      if (i === 2 || (error as {code?: string})?.code !== "P2034") throw error;
    }
  }
  throw new CommerceInvariantError("TRANSACTION_CONFLICT", "Payment handoff retry budget exceeded");
}

/** Step 1: CAS PREPARED -> SESSION_CREATING, extending all related stock holds
 * in the SAME transaction. No external API calls are made inside transactions.
 * Repeated reads of SESSION_CREATING return the same provider operation key;
 * the adapter must use that key to retrieve/retry a provider session safely.
 */
export async function claimCheckoutForProvider(ref: PaymentHandoffRef, now = new Date()) {
  const organizationId = validateTenantId(ref.organizationId);
  const storeId = validateTenantId(ref.storeId);
  const attemptId = validateTenantId(ref.attemptId);
  if (!Number.isFinite(now.getTime())) throw new CommerceInvariantError("INVALID_DATE", "Invalid claim time");
  return withSerializableRetry(async tx => {
    const attempt = await tx.checkoutAttempt.findFirst({
      where: {id: attemptId, organizationId, storeId}, select: attemptSelect,
    });
    if (!attempt) throw new CommerceInvariantError("CHECKOUT_NOT_FOUND", "Checkout not found");
    enforceOwner(attempt,{organizationId,storeId,attemptId});
    ensurePending(attempt);
    if (attempt.expiresAt <= now) {
      // SESSION_CREATING can represent an externally-created provider session.
      // Never expire it or release inventory without independently verifying the provider.
      throw new CommerceInvariantError("PROVIDER_RECONCILIATION_REQUIRED", "Checkout requires provider reconciliation");
    }
    const operationKey = providerSessionOperationKey(attempt.id,attempt.connectionId);
    if (attempt.status === "SESSION_CREATED") {
      if (!attempt.providerSessionId) throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT", "Stored session is missing");
      return {status:"SESSION_CREATED" as const, attemptId, orderId:attempt.orderId,
        providerSessionId:attempt.providerSessionId, expiresAt:attempt.expiresAt, replay:true as const};
    }
    if (attempt.status === "SESSION_CREATING") {
      if (attempt.providerSessionId) throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT", "Session creation state is inconsistent");
      return {status:"SESSION_CREATING" as const, attemptId, orderId:attempt.orderId,
        provider:attempt.connection.provider, providerAccount:attempt.connection.accountRef,
        connectionId:attempt.connectionId, operationKey,
        totalMinor:attempt.order.totalMinor, currency:attempt.order.currency,
        expiresAt:attempt.expiresAt,replay:true as const};
    }
    if (attempt.providerSessionId) throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT", "Prepared checkout has a provider session");
    if (now.getTime() - attempt.createdAt.getTime() > MAX_CLAIM_AGE_MS) {
      throw new CommerceInvariantError("CHECKOUT_CLOSED", "Checkout preparation is too old");
    }
    const extendedExpiry = new Date(now.getTime() + SESSION_HOLD_MINUTES*60*1000);
    const claimed = await tx.checkoutAttempt.updateMany({
      where: {id:attemptId,organizationId,storeId,status:"PREPARED",providerSessionId:null,expiresAt:{gt:now}},
      data: {status:"SESSION_CREATING",expiresAt:extendedExpiry},
    });
    if (claimed.count !== 1) throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT", "Checkout changed during claim");
    await tx.stockHold.updateMany({
      where: {organizationId, status:"HELD", item: {orderId:attempt.orderId}},
      data: {expiresAt:extendedExpiry},
    });
    return {status:"SESSION_CREATING" as const, attemptId, orderId:attempt.orderId,
      provider:attempt.connection.provider, providerAccount:attempt.connection.accountRef,
      connectionId:attempt.connectionId, operationKey,
      totalMinor:attempt.order.totalMinor, currency:attempt.order.currency,
      expiresAt:extendedExpiry,replay:false as const};
  });
}

/** Step 2: Record a server-verified provider receipt. This does NOT mark order paid.
 * The adapter must independently authenticate provider account, operation key,
 * session ownership, amount, currency, and expiration. Never call this with browser JSON.
 */
export async function attachVerifiedProviderSession(ref: PaymentHandoffRef, receipt: ProviderCheckoutReceipt, now = new Date()) {
  const organizationId=validateTenantId(ref.organizationId);
  const storeId=validateTenantId(ref.storeId);
  const attemptId=validateTenantId(ref.attemptId);
  if (!Number.isFinite(now.getTime())) throw new CommerceInvariantError("INVALID_DATE","Invalid receipt time");
  return withSerializableRetry(async tx => {
    const attempt=await tx.checkoutAttempt.findFirst({
      where:{id:attemptId,organizationId,storeId},select:attemptSelect,
    });
    if (!attempt) throw new CommerceInvariantError("CHECKOUT_NOT_FOUND","Checkout not found");
    enforceOwner(attempt,{organizationId,storeId,attemptId});
    ensurePending(attempt);
    // State gates come before receipt validation. A PREPARED attempt must never
    // accept an attached provider session, even if the receipt is malformed or
    // expires after its short pre-session stock hold.
    if (attempt.status !== "SESSION_CREATING" && attempt.status !== "SESSION_CREATED") {
      throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT", "Checkout is not awaiting a provider session");
    }
    if (attempt.status === "SESSION_CREATING" && attempt.providerSessionId) {
      throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT", "Checkout is not awaiting a provider session");
    }
    const operationKey=providerSessionOperationKey(attempt.id,attempt.connectionId);
    if (!receipt || receipt.provider!==attempt.connection.provider ||
        receipt.providerAccount!==attempt.connection.accountRef ||
        receipt.operationKey!==operationKey ||
        !/^[A-Za-z0-9_:-]{6,255}$/.test(receipt.sessionId) ||
        receipt.amountMinor!==attempt.order.totalMinor ||
        receipt.currency!==attempt.order.currency ||
        !(receipt.expiresAt instanceof Date) || !Number.isFinite(receipt.expiresAt.getTime()) ||
        receipt.expiresAt<=now || receipt.expiresAt>attempt.expiresAt) {
      throw new CommerceInvariantError("PROVIDER_RECEIPT_MISMATCH", "Payment provider receipt does not match the merchant checkout");
    }
    if (attempt.status === "SESSION_CREATED") {
      if (attempt.providerSessionId !== receipt.sessionId) {
        throw new CommerceInvariantError("PROVIDER_SESSION_CONFLICT","Different provider session already recorded");
      }
      return {status:"SESSION_CREATED" as const, attemptId, orderId:attempt.orderId,
        providerSessionId:receipt.sessionId,replay:true as const};
    }
    const recorded=await tx.checkoutAttempt.updateMany({
      where: {id:attemptId,organizationId,storeId,status:"SESSION_CREATING",providerSessionId:null},
      data: {status:"SESSION_CREATED",providerSessionId:receipt.sessionId},
    });
    if (recorded.count !== 1) throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT", "Session attachment conflict");
    return {status:"SESSION_CREATED" as const, attemptId, orderId:attempt.orderId,
      providerSessionId:receipt.sessionId,replay:false as const};
  });
}
