import { sendMail } from "@acme/core/lib/email";

/** The only delivery input is supplied by the trusted database claim logic.
 * Do not accept email address or raw code from a browser payload.
 */
export async function deliverGuestClaimCode(message: {
  to: string;
  code: string;
  expiresAt: Date;
}): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(message.code)) throw new Error("Invalid claim code");
  if (!Number.isFinite(message.expiresAt.getTime())) throw new Error("Invalid claim expiration");
  const text = [
    "Your ZileDigital purchase verification code:",
    "",
    message.code,
    "",
    "Enter this code while signed in to the account that requested the claim.",
    "The code expires in 10 minutes and can only be used once.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `<p>Your ZileDigital purchase verification code:</p><p><code>${message.code}</code></p>` +
    `<p>Enter this code while signed in to the account that requested the claim. ` +
    `It expires in 10 minutes and can only be used once.</p>`;
  await sendMail({ to: message.to, subject: "Verify your digital purchase", text, html });
}
