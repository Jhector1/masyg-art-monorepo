import { CommerceInvariantError } from "./commerce-invariants";
import { providerSessionOperationKey } from "./payment-handoff";
import { validateTenantId } from "./tenancy";

/** Test-only Stripe Connect direct-charge policy. Pure, no API calls or secrets. */
export type StripeClaim = {
  organizationId: string;
  storeId: string;
  attemptId: string;
  orderId: string;
  connectionId: string;
  provider: string;
  providerAccount: string;
  operationKey?: string;
  totalMinor: number;
  currency: string;
  expiresAt: Date;
};
export type StripeSessionSpec = {
  attemptId: string;
  orderId: string;
  connectionId: string;
  organizationId: string;
  storeId: string;
  providerAccount: string;
  operationKey: string;
  totalMinor: number;
  currency: string;
  email: string;
  origin: string;
  expiresAtSeconds: number;
  holdExpiresAt: Date;
};
export type StripeSessionSnapshot = {
  id: string;
  livemode: boolean;
  mode: string | null;
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  expires_at: number;
  client_reference_id: string | null;
  metadata: Record<string,string> | null;
  url: string | null;
};

function fail(): never {
  throw new CommerceInvariantError("STRIPE_SESSION_INVALID", "Stripe checkout session cannot be trusted for this merchant");
}
function validDate(date: Date): boolean {
  return date instanceof Date && Number.isFinite(date.getTime());
}
export function assertStripeTestCredential(secret: string, account: string): void {
  // Never accept live keys, even when the caller incorrectly sets a test flag.
  if (typeof secret !== "string" || !/^sk_test_[A-Za-z0-9]{8,}$/.test(secret) ||
      typeof account !== "string" || !/^acct_[A-Za-z0-9]{6,}$/.test(account)) {
    throw new CommerceInvariantError("STRIPE_TEST_CONNECTION_REQUIRED", "A verified Stripe Connect test connection is required");
  }
}

/** Local Stripe return address ONLY for an explicitly opted-in localhost development run.
 * Does not verify public domains, alter merchant/buyer validation, or authorize payments.
 * The destination is a constant, never derived from client headers or user input. */
export function stripeTestLocalReturnOrigin(args: {
  nodeEnv: string | undefined;
  optedIn: string | undefined;
  checkoutEnabled: string | undefined;
  databaseUrl: string | undefined;
}): "http://localhost:3001" | null {
  if (args.nodeEnv !== "development" || args.optedIn !== "true" ||
      args.checkoutEnabled !== "true") return null;
  try {
    const db = new URL(args.databaseUrl ?? "");
    if ((db.protocol !== "postgresql:" && db.protocol !== "postgres:") ||
        (db.hostname !== "localhost" && db.hostname !== "127.0.0.1") ||
        (db.port !== "" && db.port !== "5432" && db.port !== "55432") ||
        decodeURIComponent(db.pathname) !== "/haitian_art_store" ||
        db.searchParams.get("schema") !== "ziledigital") return null;
  } catch { return null; }
  return "http://localhost:3001";
}

/** Public return URLs require a DB-verified hostname; localhost is permitted only
 * when the gateway has independently approved the strict development policy. */
export function planStripeTestSession(
  claim: StripeClaim,
  email: string,
  verifiedHostname: string,
  now: Date = new Date(),
  existingSession = false,
  localDevelopmentOrigin: "http://localhost:3001" | null = null,
): StripeSessionSpec {
  if (!validDate(now) || !validDate(claim.expiresAt)) fail();
  const attemptId = validateTenantId(claim.attemptId);
  const orderId = validateTenantId(claim.orderId);
  const connectionId = validateTenantId(claim.connectionId);
  const organizationId = validateTenantId(claim.organizationId);
  const storeId = validateTenantId(claim.storeId);
  const validVerifiedHostname = typeof verifiedHostname === "string" && verifiedHostname.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(verifiedHostname) &&
    !verifiedHostname.includes("..") && verifiedHostname.includes(".") &&
    !verifiedHostname.startsWith("localhost") && !verifiedHostname.endsWith(".localhost");
  const validLocalReturn = verifiedHostname === "" &&
    localDevelopmentOrigin === "http://localhost:3001";
  if (typeof claim.provider!=="string" || claim.provider.toLowerCase() !== "stripe" ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(claim.providerAccount) ||
      !Number.isSafeInteger(claim.totalMinor) || claim.totalMinor < 1 || claim.totalMinor > 2_147_483_647 ||
      !/^[A-Z]{3}$/.test(claim.currency) ||
      typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (!validVerifiedHostname && !validLocalReturn)) fail();
  const expectedKey = providerSessionOperationKey(attemptId,connectionId);
  if (claim.operationKey != null && claim.operationKey !== expectedKey) fail();
  // 35 minutes from now, and at least 60 seconds before the persisted stock hold.
  // Stripe requires >=30 minutes. A replay close to hold expiration must STOP rather than extend
  // the hold outside a transaction or start a session that cannot be safely reserved.
  const expiresAtSeconds = Math.floor(claim.expiresAt.getTime()/1000) - 10*60;
  if (!existingSession && expiresAtSeconds < Math.ceil(now.getTime()/1000)+30*60) {
    throw new CommerceInvariantError("STRIPE_HOLD_TOO_SHORT", "Checkout requires reconciliation or a new reservation");
  }
  return {attemptId,orderId,connectionId,organizationId,storeId,
    providerAccount:claim.providerAccount,operationKey:expectedKey,
    totalMinor:claim.totalMinor,currency:claim.currency,email,
    origin:validLocalReturn?"http://localhost:3001":`https://${verifiedHostname}`,
    expiresAtSeconds,holdExpiresAt:claim.expiresAt};
}

/** Check ALL merchant-linked purchase facts before ever recording the session. */
export function verifyStripeTestSession(session: StripeSessionSnapshot, spec: StripeSessionSpec, now = new Date()) {
  if (!validDate(now) || !session || typeof session !== "object" ||
      !/^cs_test_[A-Za-z0-9_]+$/.test(session.id) ||
      session.livemode !== false || session.mode !== "payment" ||
      session.status !== "open" || session.payment_status !== "unpaid" ||
      session.amount_total !== spec.totalMinor ||
      session.currency !== spec.currency.toLowerCase() ||
      session.client_reference_id !== spec.attemptId ||
      session.metadata?.attemptId !== spec.attemptId ||
      session.metadata?.orderId !== spec.orderId ||
      session.metadata?.organizationId !== spec.organizationId ||
      session.metadata?.storeId !== spec.storeId ||
      session.metadata?.connectionId !== spec.connectionId ||
      session.metadata?.operationKey !== spec.operationKey ||
      !Number.isSafeInteger(session.expires_at) ||
      session.expires_at*1000 <= now.getTime() ||
      session.expires_at*1000 > spec.holdExpiresAt.getTime() ||
      typeof session.url !== "string") fail();
  let parsed: URL;
  try { parsed = new URL(session.url); } catch { return fail(); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "checkout.stripe.com" ||
      parsed.username || parsed.password || parsed.port || !parsed.pathname.startsWith("/")) fail();
  return {
    provider:"stripe",providerAccount:spec.providerAccount,sessionId:session.id,
    operationKey:spec.operationKey,amountMinor:spec.totalMinor,currency:spec.currency,
    expiresAt:new Date(session.expires_at*1000),url:session.url,
  };
}
