export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@acme/core/lib/email";
import { z } from "zod";

const CONTACT_TO = process.env.CONTACT_INBOX || "info@ziledigital.com";
const SITE_NAME = "Ziledigital";

// Basic schema & sanitization
const ContactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  message: z.string().min(10).max(5000),
  // Honeypot: real users won't fill this
  website: z.string().optional().default(""),
});

const sanitize = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { name, email, message, website } = parsed.data;

    // Honeypot dump
    if (website) return NextResponse.json({ ok: true });

    const cleanName = sanitize(name);
    const cleanEmail = sanitize(email);
    const cleanMsg = message.trim();

    // Owner notification
    const ownerSubject = `New contact form message from ${cleanName}`;
    const ownerText = [
      `From: ${cleanName} <${cleanEmail}>`,
      `Message:`,
      cleanMsg,
    ].join("\n\n");

    const ownerHtml = buildOwnerHtml({
      site: SITE_NAME,
      name: cleanName,
      email: cleanEmail,
      message: cleanMsg,
    });

    await sendMail({
      to: CONTACT_TO,
      subject: ownerSubject,
      html: ownerHtml,
      text: ownerText,
    });

    // Optional: simple auto-reply to the sender (uncomment to enable)
    await sendMail({
      to: cleanEmail,
      subject: `Thanks for contacting ${SITE_NAME}`,
      html: buildAutoReplyHtml({ site: SITE_NAME, name: cleanName }),
      text: `Hi ${cleanName},\n\nWe received your message and will reply shortly.\n\n— ${SITE_NAME}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CONTACT_API_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

/** Table-based, inline-styled email for max compatibility */
function buildOwnerHtml(props: {
  site: string;
  name: string;
  email: string;
  message: string;
}) {
  const { site, name, email, message } = props;
  // Escape very basic HTML
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `
  <div style="background:#f4f4f5;padding:24px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td style="background:#4f46e5;color:#ffffff;padding:20px 24px;font-family:Arial,Helvetica,sans-serif">
          <h1 style="margin:0;font-size:20px;line-height:1.4">${esc(site)} — New Message</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827">
          <p style="margin:0 0 12px 0"><strong>Name:</strong> ${esc(name)}</p>
          <p style="margin:0 0 12px 0"><strong>Email:</strong> ${esc(email)}</p>
          <p style="margin:0 0 8px 0"><strong>Message</strong></p>
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap">${esc(
            message
          )}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:12px">
          This message was sent from the contact form on ${esc(site)}.
        </td>
      </tr>
    </table>
  </div>`;
}

function buildAutoReplyHtml(props: { site: string; name: string }) {
  const { site, name } = props;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
  <div style="background:#f4f4f5;padding:24px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td style="background:#4f46e5;color:#ffffff;padding:20px 24px;font-family:Arial,Helvetica,sans-serif">
          <h1 style="margin:0;font-size:20px;line-height:1.4">Thanks, ${esc(name)}!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827">
          <p style="margin:0 0 12px 0">We received your message and will reply shortly.</p>
          <p style="margin:0">— ${esc(site)}</p>
        </td>
      </tr>
    </table>
  </div>`;
}
