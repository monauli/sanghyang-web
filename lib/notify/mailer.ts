import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Pengirim email. SATU-SATUNYA file yang tahu caranya mengirim — kalau nanti
 * pindah ke Telegram atau gateway WhatsApp, file inilah yang diganti, bukan
 * yang lain.
 *
 * Pakai SMTP Gmail + App Password (bukan password akun). App Password
 * mensyaratkan verifikasi 2 langkah aktif di akun Gmail tersebut.
 */

let cached: Transporter | null = null;

export function mailerReady(): boolean {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim());
}

function transporter(): Transporter {
  cached ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASSWORD!.trim(),
    },
  });
  return cached;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await transporter().sendMail({
    from: `Sanghyang Resort <${process.env.SMTP_USER!.trim()}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
