import 'server-only';
import { mailerReady, sendMail } from './mailer';

/**
 * Kirim email link reset password. TIDAK PERNAH melempar — dipanggil dari
 * Server Action yang harus selalu balas sukses generik ke user (anti-
 * enumeration), jadi kegagalan kirim email cuma dicatat di log server.
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!mailerReady()) {
    console.warn(`[password-reset] SMTP belum siap, email ke ${to} dilewati`);
    return;
  }

  const subject = 'Reset Password Panel Admin Sanghyang Resort';
  const text =
    `Ada permintaan reset password untuk akun panel admin Anda.\n\n` +
    `Klik link berikut untuk mengatur password baru (berlaku 30 menit):\n${resetLink}\n\n` +
    `Kalau Anda tidak meminta ini, abaikan email ini saja.`;
  const html =
    `<p>Ada permintaan reset password untuk akun panel admin Anda.</p>` +
    `<p><a href="${resetLink}">Klik di sini untuk mengatur password baru</a> (berlaku 30 menit).</p>` +
    `<p>Kalau Anda tidak meminta ini, abaikan email ini saja.</p>`;

  try {
    await sendMail({ to, subject, html, text });
  } catch (err) {
    console.error(`[password-reset] Gagal kirim email ke ${to}:`, err);
  }
}
