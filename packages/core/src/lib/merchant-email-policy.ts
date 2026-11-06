/** Password signup verification policy. Default-deny bypass: only literal false skips the challenge. */
export function requiresMerchantEmailVerification(setting: string | undefined): boolean {
  return setting !== "false";
}
