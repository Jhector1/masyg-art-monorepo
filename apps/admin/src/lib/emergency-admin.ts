import { createHash, timingSafeEqual } from "crypto";

export const EMERGENCY_ADMIN_USER_ID = "env-emergency-admin";

function isEnabledValue(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

export function isEmergencyAdminEnabled() {
  return isEnabledValue(process.env.EMERGENCY_ADMIN_ENABLED);
}

export function getEmergencyAdminEmail() {
  const email = process.env.EMERGENCY_ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function isEmergencyAdminUserId(userId: string | null | undefined) {
  return userId === EMERGENCY_ADMIN_USER_ID;
}

export function validateEmergencyAdminCredentials(
  email: string,
  password: string,
) {
  if (!isEmergencyAdminEnabled()) return false;

  const expectedEmail = getEmergencyAdminEmail();
  const expectedPassword = process.env.EMERGENCY_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;

  const suppliedEmail = email.trim().toLowerCase();
  return (
    safeEqual(suppliedEmail, expectedEmail) &&
    safeEqual(password, expectedPassword)
  );
}
