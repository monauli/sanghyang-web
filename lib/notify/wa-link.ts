/**
 * Nomor telepon tamu disimpan apa adanya (kolom customer_phone sengaja
 * longgar: "+62", "08xx", spasi, strip). wa.me butuh format internasional
 * tanpa tanda apa pun, jadi dinormalkan di sini — satu tempat.
 */

const MIN_DIGITS = 9;
const MAX_DIGITS = 15;

export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;

  let local: string;
  if (digits.startsWith('+62')) local = digits.slice(3);
  else if (digits.startsWith('62')) local = digits.slice(2);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;

  local = local.replace(/\D/g, '');
  if (local.length < MIN_DIGITS - 2 || local.length > MAX_DIGITS - 2) return null;

  return `62${local}`;
}

export function waLink(raw: string, message: string): string | null {
  const phone = normalizePhone(raw);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
