import { passwordResetInput } from "./password-reset-input";
const token="c".repeat(48);
describe("password reset request contract", () => {
  test("accepts a valid reset token and matching password", () => {
    expect(passwordResetInput.safeParse({token,newPassword:"long-password-1",confirmPassword:"long-password-1"}).success).toBe(true);
  });
  test("refuses a mismatched confirmation", () => {
    expect(passwordResetInput.safeParse({token,newPassword:"long-password-1",confirmPassword:"different-password"}).success).toBe(false);
  });
  test("refuses short passwords or reset tokens", () => {
    expect(passwordResetInput.safeParse({token,newPassword:"123",confirmPassword:"123"}).success).toBe(false);
    expect(passwordResetInput.safeParse({token:"tiny",newPassword:"long-password-1",confirmPassword:"long-password-1"}).success).toBe(false);
  });
  test("rejects unknown fields, including arbitrary userId", () => {
    expect(passwordResetInput.safeParse({token,newPassword:"long-password-1",confirmPassword:"long-password-1",userId:"someone"}).success).toBe(false);
  });
});
