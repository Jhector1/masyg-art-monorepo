import "server-only";
/** Mail provider is called only after owner authorization and DB invitation creation.
 * Do not expose secret tokens in provider metadata, app logs, or API JSON responses. */
export function invitationMailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ZILEDIGITAL_INVITE_FROM;
  const originText = process.env.ZILEDIGITAL_ADMIN_ORIGIN;
  if (!apiKey || !from || !originText) throw new Error("Staff invitation email is not configured");
  const origin = new URL(originText);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/" ||
    !(origin.protocol === "https:" || (origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
    throw new Error("Invalid Admin origin for invitations");
  }
  return { apiKey, from, origin: origin.origin };
}
export async function sendMerchantInviteEmail(args: {
  invitationId: string; token: string; email: string; role: "ADMIN" | "MEMBER";
}) {
  const config = invitationMailConfig();
  const inviteUrl = `${config.origin}/merchant/invitations/accept#token=${encodeURIComponent(args.token)}`;
  const text = [
    "You have been invited to help manage a ZileDigital merchant organization.",
    `Role: ${args.role === "MEMBER" ? "Storefront viewer" : "Organization administrator"}`,
    "The invitation expires in seven days and can be used only once.",
    "Open this link and sign in using the invited email address:", inviteUrl,
    "If you were not expecting this invitation, ignore this message.",
  ].join("\n\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json",
      "Idempotency-Key": `ziledigital-staff-invite-${args.invitationId}`, "User-Agent": "ZileDigital Admin/1.0" },
    body: JSON.stringify({ from: config.from, to: [args.email], subject: "ZileDigital staff invitation", text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Email provider rejected staff invitation");
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string")
    throw new Error("Email provider returned no delivery reference");
  return result.id;
}
