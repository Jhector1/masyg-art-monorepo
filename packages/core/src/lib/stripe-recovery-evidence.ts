import { CommerceInvariantError } from "./commerce-invariants";
import type { VerifiedPaidEvidence } from "./stripe-paid-evidence";

/** Provider API retrieval, not a signed webhook. Never fabricate a Stripe evt_ ID. */
export type VerifiedRecoveredStripePaidEvidence = Omit<VerifiedPaidEvidence, "providerEventId"> & {
  source: "PROVIDER_RETRIEVAL";
  organizationId: string;
  storeId: string;
  connectionId: string;
};

export type RecoveryAttempt = {
  id: string; organizationId: string; storeId: string; orderId: string;
  connectionId: string; status: string; providerSessionId: string | null;
  order: {id: string; organizationId: string; storeId: string; status: string;
    totalMinor: number; currency: string};
  connection: {id: string; organizationId: string; provider: string;
    accountRef: string; status: string; verifiedAt: Date | null; capabilities: readonly string[]};
};

type Metadata = Record<string, string> | null;
export type RecoveryStripeSession = {
  id: string; livemode: boolean; mode: string | null; status: string | null;
  payment_status: string; amount_total: number | null; currency: string | null;
  client_reference_id: string | null; metadata: Metadata;
  payment_intent: string | null | {
    id: string; status: string; livemode: boolean; currency: string;
    amount_received: number; metadata: Metadata;
    latest_charge?: string | null | {id: string};
  };
};
export type RecoveryStripeCharge = {
  id: string; livemode: boolean; status: string; paid: boolean; captured: boolean;
  amount: number; amount_refunded: number; refunded: boolean; currency: string;
  payment_intent: string | null | {id: string};
};
export type RecoveryStripeRefundProbe = {data: readonly unknown[]; has_more: boolean};

function fail(): never {
  throw new CommerceInvariantError("STRIPE_RECOVERY_EVIDENCE_INVALID",
    "Verified, unrefunded Stripe test payment and matching merchant checkout required");
}
function id(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}

/** Accept only fully captured, unrefunded TEST payments. Refund records (including
 * pending/failed entries) are a manual reconciliation boundary; fail closed.
 * The caller must retrieve Session, Charge and refund probe from Stripe using
 * the stored connected account, never from browser data or webhook JSON.
 */
export function validateRecoveredStripePaidEvidence(args: {
  attempt: RecoveryAttempt; session: RecoveryStripeSession;
  charge: RecoveryStripeCharge; refunds: RecoveryStripeRefundProbe;
}): VerifiedRecoveredStripePaidEvidence {
  const {attempt:a, session:s, charge:c, refunds:r} = args;
  if(!a || !s || !c || !r ||
      a.status !== "SESSION_CREATED" || a.order?.status !== "PENDING" ||
      a.order.id !== a.orderId || a.order.organizationId !== a.organizationId ||
      a.order.storeId !== a.storeId ||
      a.connection?.id !== a.connectionId ||
      a.connection.organizationId !== a.organizationId ||
      a.connection.provider.toLowerCase() !== "stripe" ||
      a.connection.status !== "VERIFIED" || !a.connection.verifiedAt ||
      !a.connection.capabilities.includes("payments") ||
      !id(a.connection.accountRef, /^acct_[A-Za-z0-9]{6,}$/) ||
      !id(a.providerSessionId, /^cs_test_[A-Za-z0-9_]+$/) ||
      !Number.isSafeInteger(a.order.totalMinor) || a.order.totalMinor < 1 ||
      a.order.totalMinor > 2147483647 || !id(a.order.currency, /^[A-Z]{3}$/) ||
      s.id !== a.providerSessionId || s.livemode !== false ||
      s.mode !== "payment" || s.status !== "complete" || s.payment_status !== "paid" ||
      s.client_reference_id !== a.id ||
      s.metadata?.attemptId !== a.id ||
      s.metadata?.orderId !== a.orderId ||
      s.metadata?.organizationId !== a.organizationId ||
      s.metadata?.storeId !== a.storeId ||
      s.metadata?.connectionId !== a.connectionId ||
      s.amount_total !== a.order.totalMinor ||
      s.currency !== a.order.currency.toLowerCase()) fail();
  const intent=s.payment_intent;
  if(!intent || typeof intent !== "object" ||
      !id(intent.id, /^pi_[A-Za-z0-9_]+$/) ||
      intent.livemode !== false || intent.status !== "succeeded" ||
      intent.amount_received !== a.order.totalMinor || intent.currency !== s.currency ||
      intent.metadata?.attemptId !== a.id ||
      intent.metadata?.orderId !== a.orderId ||
      intent.metadata?.organizationId !== a.organizationId ||
      intent.metadata?.storeId !== a.storeId ||
      intent.metadata?.connectionId !== a.connectionId) fail();
  const chargeId = typeof intent.latest_charge === "string"
    ? intent.latest_charge : intent.latest_charge?.id;
  const paymentIntentId = typeof c.payment_intent === "string"
    ? c.payment_intent : c.payment_intent?.id;
  if(!chargeId || !id(chargeId, /^ch_[A-Za-z0-9_]+$/) ||
      c.id !== chargeId || c.livemode !== false ||
      c.paid !== true || c.captured !== true || c.status !== "succeeded" ||
      c.amount !== a.order.totalMinor || c.currency !== s.currency ||
      c.refunded !== false || c.amount_refunded !== 0 ||
      paymentIntentId !== intent.id ||
      !Array.isArray(r.data) || r.data.length !== 0 || r.has_more !== false) fail();
  return {source:"PROVIDER_RETRIEVAL",provider:"stripe",
    providerAccount:a.connection.accountRef,providerPaymentId:intent.id,
    sessionId:s.id,attemptId:a.id,orderId:a.orderId,
    amountMinor:a.order.totalMinor,currency:a.order.currency,
    organizationId:a.organizationId,storeId:a.storeId,connectionId:a.connectionId};
}
