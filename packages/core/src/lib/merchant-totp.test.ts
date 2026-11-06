import { decodeBase32, encodeBase32, totpAt, matchingTotpStep, encryptTotpSecret, decryptTotpSecret, newTotpSecret } from "./merchant-totp";
test("RFC 6238 SHA1 vector and anti-invalid-code", () => {
  const key = encodeBase32(Buffer.from("12345678901234567890"));
  expect(totpAt(key, 59 / 30 | 0)).toBe("287082");
  expect(matchingTotpStep(key, "287082", 59000)).toBe(1);
  expect(matchingTotpStep(key, "nototp", 59000)).toBeNull();
});
test("encrypted secrets are authenticated and never stored in plaintext", () => {
  process.env.ZILEDIGITAL_MERCHANT_MFA_ENCRYPTION_KEY = "11".repeat(32);
  const original = newTotpSecret(); const ciphertext = encryptTotpSecret(original);
  expect(ciphertext).not.toContain(original);
  expect(decryptTotpSecret(ciphertext)).toBe(original);
  const parts = ciphertext.split(":");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  expect(() => decryptTotpSecret(parts.join(":"))).toThrow();
  expect(decodeBase32(original).length).toBe(20);
  delete process.env.ZILEDIGITAL_MERCHANT_MFA_ENCRYPTION_KEY;
});
