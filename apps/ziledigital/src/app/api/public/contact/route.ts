// File: src/app/api/public/contact/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMail } from "@acme/core/lib/email";
import { prisma } from "@acme/core/lib/prisma";

/**
 * ENV
 * - CONTACT_INBOX="info@ziledigital.com"
 * - CONTACT_ALLOWED_ORIGINS="https://ziledigital.com,https://www.ziledigital.com,http://localhost:3000"
 * - CONTACT_AUTOREPLY="0" (default) or "1"
 */
const CONTACT_TO = process.env.CONTACT_INBOX || "info@ziledigital.com";
const SITE_NAME = "Ziledigital";
const AUTO_REPLY = process.env.CONTACT_AUTOREPLY === "1";

const ALLOWED_ORIGINS = new Set(
  (process.env.CONTACT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

/**
 * Contact payload
 * - website is honeypot; real users won’t fill it
 */
const ContactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(200),
  message: z.string().min(10).max(5000),

  // Honeypot
  website: z.string().optional().default(""),

  // Optional client metadata (safe)
  subject: z.string().max(120).optional(),
});

/** Prevent header injection + normalize text fields */
function sanitizeLine(s: string) {
  return s.replace(/[\r\n]+/g, " ").trim();
}

/** Simple HTML escape */
function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Determine client IP for logging/rate limiting */
function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Basic per-IP rate limiting.
 * This uses your DB (Prisma) so it works across server instances.
 *
 * You’ll need a Prisma model (example below).
 */
async function enforceRateLimit(ip: string) {
  // allow 5 requests per 10 minutes per IP
  const windowMs = 10 * 60 * 1000;
  const limit = 5;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  // Cleanup old rows (cheap)
  await prisma.contactRateLimit.deleteMany({
    where: { createdAt: { lt: windowStart } },
  });

  const count = await prisma.contactRateLimit.count({
    where: { ip, createdAt: { gte: windowStart } },
  });

  if (count >= limit) {
    return false;
  }

  await prisma.contactRateLimit.create({
    data: { ip },
  });

  return true;
}

/** Origin / CSRF-ish check (works for browser POSTs) */
function originAllowed(req: NextRequest) {
  // If you don’t configure allowed origins, skip.
  if (ALLOWED_ORIGINS.size === 0) return true;

  const origin = req.headers.get("origin");
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // ✅ Block cross-site form posts unless allowed
    if (!originAllowed(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ Rate limit
    const ok = await enforceRateLimit(ip);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = ContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { name, email, message, website, subject } = parsed.data;

    // ✅ Honeypot: pretend success (don’t tell bots)
    if (website && website.trim().length > 0) {
      return NextResponse.json({ ok: true });
    }

    const cleanName = sanitizeLine(name);
    const cleanEmail = sanitizeLine(email);
    const cleanSubject = sanitizeLine(subject || `New message from ${cleanName}`);
    const cleanMsg = message.trim();

    // ✅ Optional: log the attempt (helps detect abuse)
    await prisma.contactMessage.create({
      data: {
        ip,
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMsg,
        userAgent: req.headers.get("user-agent") || "",
        origin: req.headers.get("origin") || "",
      },
    });

    // ---- Owner notification ----
    const ownerSubject = `[${SITE_NAME}] ${cleanSubject}`;
    const ownerText = [`From: ${cleanName} <${cleanEmail}>`, "", cleanMsg].join(
      "\n"
    );

    const ownerHtml = buildOwnerHtml({
      site: SITE_NAME,
      name: cleanName,
      email: cleanEmail,
      message: cleanMsg,
      subject: cleanSubject,
      ip,
    });

    await sendMail({
      to: CONTACT_TO,
      subject: ownerSubject,
      html: ownerHtml,
      text: ownerText,
      // ✅ If your mailer supports it, use replyTo instead of from spoofing
      replyTo: cleanEmail as any,
    } as any);

    // ---- Optional auto-reply ----
    if (AUTO_REPLY) {
      // Keep it generic to avoid confirming a “live” inbox to spammers
      await sendMail({
        to: cleanEmail,
        subject: `We received your message — ${SITE_NAME}`,
        html: buildAutoReplyHtml({ site: SITE_NAME, name: cleanName }),
        text: `Hi ${cleanName},\n\nWe received your message and will reply shortly.\n\n— ${SITE_NAME}`,
      });
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[CONTACT_API_ERROR]", err);

    // Don’t leak server details; also don’t help attackers
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

/** Table-based, inline-styled email */
function buildOwnerHtml(props: {
  site: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string;
}) {
  const { site, name, email, subject, message, ip } = props;

  return `
  <div style="background:#f4f4f5;padding:24px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td style="background:#4f46e5;color:#ffffff;padding:20px 24px;font-family:Arial,Helvetica,sans-serif">
          <h1 style="margin:0;font-size:20px;line-height:1.4">${escHtml(
            site
          )} — New Message</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827">
          <p style="margin:0 0 10px 0"><strong>Subject:</strong> ${escHtml(subject)}</p>
          <p style="margin:0 0 10px 0"><strong>Name:</strong> ${escHtml(name)}</p>
          <p style="margin:0 0 10px 0"><strong>Email:</strong> ${escHtml(email)}</p>
          <p style="margin:0 0 10px 0"><strong>IP:</strong> ${escHtml(ip)}</p>
          <p style="margin:0 0 8px 0"><strong>Message</strong></p>
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap">${escHtml(
            message
          )}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:12px">
          Sent from the contact form on ${escHtml(site)}.
        </td>
      </tr>
    </table>
  </div>`;
}

function buildAutoReplyHtml(props: { site: string; name: string }) {
  const { site, name } = props;

  return `
  <div style="background:#f4f4f5;padding:24px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td style="background:#4f46e5;color:#ffffff;padding:20px 24px;font-family:Arial,Helvetica,sans-serif">
          <h1 style="margin:0;font-size:20px;line-height:1.4">Thanks, ${escHtml(
            name
          )}!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827">
          <p style="margin:0 0 12px 0">We received your message and will reply shortly.</p>
          <p style="margin:0">— ${escHtml(site)}</p>
        </td>
      </tr>
    </table>
  </div>`;
}
