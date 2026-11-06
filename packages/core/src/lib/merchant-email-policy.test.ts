import { requiresMerchantEmailVerification } from "./merchant-email-policy";

test("verification is required by default or when explicitly enabled", () => {
  expect(requiresMerchantEmailVerification(undefined)).toBe(true);
  expect(requiresMerchantEmailVerification("true")).toBe(true);
  expect(requiresMerchantEmailVerification("")).toBe(true);
  expect(requiresMerchantEmailVerification("FALSE")).toBe(true);
});

test("only the explicit false setting permits registration without SMTP", () => {
  expect(requiresMerchantEmailVerification("false")).toBe(false);
});
