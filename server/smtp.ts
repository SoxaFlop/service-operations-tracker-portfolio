/**
 * Environment-configured email delivery.
 *
 * Delivery is deliberately disabled unless EMAIL_ENABLED=true. No provider,
 * account or sender identity is embedded in source code.
 */

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

const emailEnabled = process.env.EMAIL_ENABLED === 'true';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !Number.isFinite(port) || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS are required when email is enabled');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

/** Sends an email when explicitly enabled, otherwise returns false safely. */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!emailEnabled) {
    console.info('[Email] Delivery disabled; message not sent');
    return false;
  }

  const from = process.env.FROM_EMAIL;
  if (!from) throw new Error('FROM_EMAIL is required when email is enabled');

  await getTransport().sendMail({
    from,
    to: options.to,
    cc: options.cc,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  });

  console.info('[Email] Message sent');
  return true;
}
