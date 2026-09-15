/**
 * Nomor telepon tamu disimpan apa adanya (kolom customer_phone sengaja
 * longgar: "+62", "08xx", spasi, strip). wa.me butuh format internasional
 * tanpa tanda apa pun, jadi dinormalkan di sini — satu tempat.
 */

const MIN_LOCAL_DIGITS = 7;
const MAX_LOCAL_DIGITS = 13;

export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;

  // "+" diikuti kode negara selain 62 -> jangan dipaksa jadi nomor Indonesia.
  if (digits.startsWith('+') && !digits.startsWith('+62')) return null;

  let local: string;
  if (digits.startsWith('+62')) local = digits.slice(3);
  else if (digits.startsWith('62')) local = digits.slice(2);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;

  local = local.replace(/\D/g, '');
  if (local.length < MIN_LOCAL_DIGITS || local.length > MAX_LOCAL_DIGITS) return null;

  return `62${local}`;
}

export function waLink(raw: string, message: string): string | null {
  const phone = normalizePhone(raw);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
