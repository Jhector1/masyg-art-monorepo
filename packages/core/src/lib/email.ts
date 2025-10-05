// File: src/lib/email.ts
import nodemailer from "nodemailer";

const from = process.env.EMAIL_FROM!;
const host = process.env.SMTP_HOST!;
const port = Number(process.env.SMTP_PORT || "587");
const user = process.env.SMTP_USER!;
const pass = process.env.SMTP_PASS!;

export const mailer = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  return mailer.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
