import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.SMTP_URL) return null;
  transporter ??= nodemailer.createTransport(env.SMTP_URL);
  return transporter;
}

/** Captured mails, only in tests — lets tests read verification/reset links. */
export const sentMail: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  if (env.isTest) {
    sentMail.push(mail);
    return;
  }
  const transport = getTransport();
  if (!transport) {
    // No SMTP configured (local dev): log the message so links can be clicked from the console.
    logger.info({ to: mail.to, subject: mail.subject }, `Email (not sent, SMTP_URL unset):\n${mail.text}`);
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, 'Failed to send email');
  }
}

const layout = (title: string, body: string, cta: { label: string; url: string }) => `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;padding:32px">
      <tr><td style="font-size:20px;font-weight:800;color:#FF2D2D;padding-bottom:16px">SyncBoard</td></tr>
      <tr><td style="font-size:18px;font-weight:700;padding-bottom:8px">${title}</td></tr>
      <tr><td style="font-size:14px;line-height:1.6;color:#444;padding-bottom:24px">${body}</td></tr>
      <tr><td><a href="${cta.url}" style="display:inline-block;background:#FF2D2D;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${cta.label}</a></td></tr>
      <tr><td style="font-size:12px;color:#888;padding-top:24px">If the button doesn't work, paste this link into your browser:<br>${cta.url}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

export function verificationEmail(to: string, displayName: string, url: string): Mail {
  return {
    to,
    subject: 'Verify your SyncBoard email',
    text: `Hi ${displayName},\n\nConfirm your email address to finish setting up SyncBoard:\n${url}\n\nThis link expires in 24 hours.`,
    html: layout(
      'Confirm your email',
      `Hi ${escapeHtml(displayName)}, confirm your email address to finish setting up SyncBoard. This link expires in 24 hours.`,
      { label: 'Verify email', url },
    ),
  };
}

export function passwordResetEmail(to: string, displayName: string, url: string): Mail {
  return {
    to,
    subject: 'Reset your SyncBoard password',
    text: `Hi ${displayName},\n\nSomeone (hopefully you) asked to reset your SyncBoard password:\n${url}\n\nThis link expires in 1 hour. If you didn't ask for this, you can ignore this email.`,
    html: layout(
      'Reset your password',
      `Hi ${escapeHtml(displayName)}, use the button below to choose a new password. This link expires in 1 hour. If you didn't ask for this, you can ignore this email.`,
      { label: 'Choose a new password', url },
    ),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
