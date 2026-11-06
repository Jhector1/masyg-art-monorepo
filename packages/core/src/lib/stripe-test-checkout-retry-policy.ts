/** A client may rotate its checkout idempotency key ONLY after the authenticated
 * server has atomically closed an expired, unsubmitted PREPARED attempt.
 * Never retry or rotate on network errors, 5xx, or uncertain provider states. */
export const CHECKOUT_PREPARED_EXPIRED = "CHECKOUT_PREPARED_EXPIRED" as const;

export function mayRetryExpiredPreparedCheckout(httpStatus: number, body: unknown): boolean {
  if (httpStatus !== 409 || body === null || typeof body !== "object" || Array.isArray(body))
    return false;
  return (body as {code?: unknown}).code === CHECKOUT_PREPARED_EXPIRED;
}
