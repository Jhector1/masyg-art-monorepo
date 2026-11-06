/** Stripe Tax Calculation IDs use the `taxcalc_` prefix (not `taxcal_`).
 * Keep the provider-ID contract in one place for digital and mixed checkout.
 * This validates ID shape only; it does not replace mode, amount, account,
 * currency, fingerprint, shipping, or expiry reconciliation.
 */
export function isStripeTaxCalculationId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // JavaScript `$` can match just before a trailing newline, so require exact length.
  const matched = /^taxcalc_[A-Za-z0-9_]+/.exec(value);
  return matched !== null && matched[0] === value;
}
