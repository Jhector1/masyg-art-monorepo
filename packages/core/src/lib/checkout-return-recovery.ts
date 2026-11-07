/** Display-only checkout return polling policy. Payment status remains server authoritative.
 * A bounded interval prevents unending background requests for pending payments.
 */
export const CHECKOUT_STATUS_POLL_INTERVAL_MS = 3_000;
export const CHECKOUT_STATUS_MAX_AUTOMATIC_POLLS = 20;

export function shouldAutoPollCheckoutStatus(processing: boolean, pollsAlreadyScheduled: number): boolean {
  return processing && Number.isSafeInteger(pollsAlreadyScheduled) &&
    pollsAlreadyScheduled >= 0 && pollsAlreadyScheduled < CHECKOUT_STATUS_MAX_AUTOMATIC_POLLS;
}
