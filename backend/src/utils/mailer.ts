import nodemailer from 'nodemailer';
import { env } from '../config/env';

function isSmtpConfigured() {
  return Boolean(
    env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASS &&
      env.SMTP_FROM_NAME &&
      env.SMTP_FROM_EMAIL,
  );
}

type VerificationPayload = {
  to: string;
  name?: string | null;
  token: string;
};

export async function sendVerificationEmail({ to, name, token }: VerificationPayload) {
  if (!isSmtpConfigured()) {
    // SMTP belum disiapkan, abaikan pengiriman email.
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  const safeName = name?.trim() ? name.trim() : 'Sahabat Tactical Education';
  const appUrl = (env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const verifyUrl = `${appUrl}/auth/verify`;

  const subject = 'Verifikasi Email Tactical Education';
  const text = [
    `Halo ${safeName},`,
    '',
    'Terima kasih sudah mendaftar di Tactical Education.',
    'Gunakan token berikut untuk verifikasi email:',
    '',
    token,
    '',
    `Buka halaman verifikasi: ${verifyUrl}`,
    '',
    'Jika Anda tidak merasa mendaftar, abaikan email ini.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">Verifikasi Email Tactical Education</h2>
      <p>Halo <strong>${safeName}</strong>,</p>
      <p>Terima kasih sudah mendaftar di Tactical Education.</p>
      <p>Gunakan token berikut untuk verifikasi email:</p>
      <div style="margin: 12px 0; padding: 12px 16px; background: #f3f4f6; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${token}
      </div>
      <p>Atau buka halaman verifikasi di bawah ini:</p>
      <p><a href="${verifyUrl}" style="color: #f97316;">${verifyUrl}</a></p>
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });

  return true;
}
