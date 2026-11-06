import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function encodeBase32(bytes: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += alphabet[(value >>> (bits -= 5)) & 31]; }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
export function decodeBase32(value: string): Buffer {
  if (!/^[A-Z2-7]{16,128}$/.test(value)) throw new Error("Invalid TOTP secret");
  let bits = 0, acc = 0; const out: number[] = [];
  for (const c of value) {
    acc = (acc << 5) | alphabet.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((acc >>> (bits -= 8)) & 255); }
  }
  return Buffer.from(out);
}
export function newTotpSecret() { return encodeBase32(randomBytes(20)); }
export function totpAt(secret: string, step: number): string {
  if (!Number.isSafeInteger(step) || step < 0) throw new Error("Invalid time step");
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const i = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(i) & 0x7fffffff) % 1000000).padStart(6, "0");
}
export function matchingTotpStep(secret: string, supplied: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(supplied)) return null;
  const step = Math.floor(now / 30000);
  for (const s of [step - 1, step, step + 1]) {
    if (s < 0) continue;
    const expected = Buffer.from(totpAt(secret, s));
    if (timingSafeEqual(expected, Buffer.from(supplied))) return s;
  }
  return null;
}
function key(): Buffer {
  const raw = process.env.ZILEDIGITAL_MERCHANT_MFA_ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error("Merchant MFA encryption key is not configured");
  return Buffer.from(raw, "hex");
}
export function encryptTotpSecret(secret: string): string {
  decodeBase32(secret);
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), payload.toString("base64url")].join(":");
}
export function decryptTotpSecret(value: string): string {
  const [version, iv, tag, body, extra] = value.split(":");
  if (version !== "v1" || !iv || !tag || !body || extra) throw new Error("Invalid credential");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const secret = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  decodeBase32(secret);
  return secret;
}
export function newRecoveryCodes() {
  return Array.from({ length: 8 }, () => randomBytes(10).toString("hex").toUpperCase());
}
export function hashRecoveryCode(value: string): string {
  const pepper = process.env.NEXTAUTH_SECRET;
  if (!pepper || pepper.length < 24) throw new Error("NEXTAUTH_SECRET is required");
  return createHmac("sha256", pepper).update("merchant-recovery:" + value.toUpperCase()).digest("hex");
}
export function hashEmailToken(value: string) {
  return createHash("sha256").update("merchant-verify:" + value).digest("hex");
}
