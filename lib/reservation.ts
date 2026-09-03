/**
 * Validasi permintaan reservasi. Aturannya sengaja dibikin cermin dari CHECK
 * constraint + RLS policy di web/db/00{1,2}_reservation_requests*.sql — kalau
 * salah satunya diubah, ubah keduanya. Database tetap jadi penjaga terakhir;
 * ini supaya user dapat pesan error yang enak dibaca, bukan error Postgres.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9 .-]{7,19}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReservationRow = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_id: string;
  service_item_id: string | null;
  reservation_date: string;
  checkout_date: string | null;
  guests: number;
  notes: string | null;
  exely_room_type_id: string | null;
  exely_room_name: string | null;
  exely_total_price: number | null;
};

export type FieldErrors = Partial<Record<keyof ReservationRow | 'form', string>>;

/** Field teks yang dikembalikan ke form kalau submit gagal, supaya tamu tidak
 *  perlu mengetik ulang. Sengaja tidak memuat honeypot maupun token. */
export const ECHO_FIELDS = [
  'service_item_id',
  'reservation_date',
  'guests',
  'customer_name',
  'customer_email',
  'customer_phone',
  'notes',
] as const;

export type EchoValues = Partial<Record<(typeof ECHO_FIELDS)[number], string>>;

export function echoValues(fd: FormData): EchoValues {
  const out: EchoValues = {};
  for (const key of ECHO_FIELDS) {
    const v = fd.get(key);
    if (typeof v === 'string' && v !== '') out[key] = v;
  }
  return out;
}

/** Tanggal hari ini di zona waktu resort (WIB), format YYYY-MM-DD. */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function parseReservationForm(
  fd: FormData
): { ok: true; data: ReservationRow } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const name = str(fd, 'customer_name');
  if (name.length < 2 || name.length > 100) errors.customer_name = 'Nama 2–100 karakter.';

  const email = str(fd, 'customer_email');
  if (!EMAIL_RE.test(email) || email.length > 160) errors.customer_email = 'Email tidak valid.';

  const phone = str(fd, 'customer_phone');
  if (!PHONE_RE.test(phone)) {
    errors.customer_phone = 'Nomor telepon tidak valid. Contoh: 0812 3456 7890.';
  }

  const serviceId = str(fd, 'service_id');
  if (!UUID_RE.test(serviceId)) errors.form = 'Kategori tidak dikenali. Muat ulang halaman.';

  const rawItem = str(fd, 'service_item_id');
  const itemId = rawItem || null;
  if (itemId && !UUID_RE.test(itemId)) errors.service_item_id = 'Pilihan tidak dikenali.';

  const today = todayJakarta();
  const date = str(fd, 'reservation_date');
  if (!DATE_RE.test(date)) errors.reservation_date = 'Tanggal wajib diisi.';
  else if (date < today) errors.reservation_date = 'Tanggal tidak boleh di masa lalu.';

  const rawCheckout = str(fd, 'checkout_date');
  const checkout = rawCheckout || null;
  if (checkout && (!DATE_RE.test(checkout) || checkout <= date)) {
    errors.checkout_date = 'Tanggal check-out harus setelah check-in.';
  }

  const guests = Number(str(fd, 'guests'));
  if (!Number.isInteger(guests) || guests < 1 || guests > 50) {
    errors.guests = 'Jumlah tamu 1–50 orang.';
  }

  const notes = str(fd, 'notes') || null;
  if (notes && notes.length > 1000) errors.notes = 'Catatan maksimal 1000 karakter.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Kolom exely_* di DB dibatasi 64/200 karakter dan numeric(12,2); dibatasi di
  // sini juga supaya kiriman yang dioprek tidak sampai jadi error Postgres.
  const roomTypeId = str(fd, 'exely_room_type_id').slice(0, 64) || null;
  const roomPrice = Number(str(fd, 'exely_total_price'));
  const priceOk = Number.isFinite(roomPrice) && roomPrice >= 0 && roomPrice < 1e10;

  return {
    ok: true,
    data: {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      service_id: serviceId,
      service_item_id: itemId,
      reservation_date: date,
      checkout_date: checkout,
      guests,
      notes,
      exely_room_type_id: roomTypeId,
      exely_room_name: roomTypeId ? str(fd, 'exely_room_name').slice(0, 200) || null : null,
      exely_total_price: roomTypeId && priceOk ? Math.round(roomPrice * 100) / 100 : null,
    },
  };
}
