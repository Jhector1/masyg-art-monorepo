// ============================================================
// 8) (Optional) Simple email helper API — replace with your provider
// ============================================================
// File: packages/server/src/email/sendResetEmail.ts (example)
// packages/server/src/email/buildResetEmail.ts
export function buildResetEmail({
  resetUrl,
  appName = "ZileDigital",
  expiresMinutes = 60,
  supportEmail = "no-reply@ziledigital.com",
  logoUrl, // optional
}: {
  resetUrl: string;
  appName?: string;
  expiresMinutes?: number;
  supportEmail?: string;
  logoUrl?: string;
}) {
  const preheader = `Reset your ${appName} password. This link expires in ${expiresMinutes} minutes.`;
  const text = [
    `${appName} — Reset your password`,
    ``,
    `We received a request to reset your password.`,
    `Use the link below to set a new one (valid for ${expiresMinutes} minutes):`,
    resetUrl,
    ``,
    `If you didn't request this, you can ignore this email.`,
    ``,
    `Need help? Contact ${supportEmail}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${appName} — Reset your password</title>
  <style>
    /* Dark-mode friendly text color (for clients that support it) */
    @media (prefers-color-scheme: dark) {
      .bg { background: #0b0b0b !important; }
      .card { background: #111111 !important; border-color: #222 !important; }
      .muted { color: #ababab !important; }
      .text { color: #f5f5f5 !important; }
      .btn { background: #6366f1 !important; color: #ffffff !important; }
      a { color: #8ab4f8 !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0;padding:0;background:#f6f7fb;">
  <!-- Preheader (hidden in most clients) -->
  <div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">
    ${preheader}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f7fb;">
    <tr>
      <td align="center" style="padding:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
          <tr>
            <td align="center" style="padding:12px 0;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${appName}" width="120" height="auto" style="display:block;border:0;outline:none;text-decoration:none;">` : `<div style="font:600 20px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">${appName}</div>`}
            </td>
          </tr>

          <tr>
            <td class="card" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
              <h1 class="text" style="margin:0 0 12px;font:700 20px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
                Reset your password
              </h1>
              <p class="muted" style="margin:0 0 16px;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;">
                We received a request to reset your password. Click the button below to set a new one. 
                This link is valid for <strong style="color:#111827;">${expiresMinutes} minutes</strong>.
              </p>

              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px;">
                <tr>
                  <td>
                    <a href="${resetUrl}" class="btn"
                       style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;
                              font:600 14px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                              padding:12px 18px;border-radius:10px;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p class="muted" style="margin:16px 0 0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;">
                Can’t use the button? Paste this link into your browser:<br>
                <a href="${resetUrl}" style="word-break:break-all;color:#4f46e5;">${resetUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p class="muted" style="margin:0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;">
                If you didn’t request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 8px;">
              <p class="muted" style="margin:0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;">
                Need help? <a href="mailto:${supportEmail}" style="color:#4f46e5;text-decoration:underline;">${supportEmail}</a>
              </p>
              <p class="muted" style="margin:8px 0 0;font:400 11px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9ca3af;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text, preheader };
}
