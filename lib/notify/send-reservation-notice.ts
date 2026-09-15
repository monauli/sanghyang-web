import 'server-only';
import { getAdminClient } from '../supabase/admin.ts';
import { buildReservationNotice } from './reservation-notice.ts';
import { mailerReady, sendMail as defaultSendMail } from './mailer.ts';

/**
 * Ambil satu reservasi + outletnya, susun email, kirim.
 *
 * TIDAK PERNAH melempar. Dipanggil dari after() setelah reservasi tersimpan
 * dan tamu sudah melihat halaman terkirim — kegagalan di sini tidak boleh
 * mengubah apa pun yang sudah terjadi. Semua kegagalan dicatat dengan id
 * reservasi supaya bisa ditindaklanjuti manual.
 */
export type NoticeRow = {
  id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reservation_date: string;
  checkout_date: string | null;
  guests: number;
  notes: string | null;
  item: { name: string } | null;
  outlet: { name: string; notify_email: string | null; is_active: boolean } | null;
};

export type Deps = {
  sendMail?: typeof defaultSendMail;
  loadReservation?: (id: string) => Promise<NoticeRow | null>;
};

/** Baca satu reservasi beserta outlet & nama item pilihannya. */
async function loadFromSupabase(reservationId: string): Promise<NoticeRow | null> {
  const supabase = getAdminClient();
  if (!supabase) {
    console.warn(`[notify] Supabase admin client belum siap, notifikasi ${reservationId} dilewati`);
    return null;
  }

  const { data, error } = await supabase
    .from('reservation_requests')
    .select(
      'id, service_id, customer_name, customer_email, customer_phone, reservation_date, ' +
        'checkout_date, guests, notes, item:service_items(name), ' +
        'outlet:outlets(name, notify_email, is_active)'
    )
    .eq('id', reservationId)
    .maybeSingle();

  if (error || !data) {
    console.error(`[notify] gagal membaca reservasi ${reservationId}: ${error?.message ?? 'tidak ditemukan'}`);
    return null;
  }
  return data as unknown as NoticeRow;
}

export async function sendReservationNotice(
  reservationId: string,
  deps: Deps = {}
): Promise<void> {
  const sendMail = deps.sendMail ?? defaultSendMail;
  const loadReservation = deps.loadReservation ?? loadFromSupabase;

  try {
    if (!deps.sendMail && !mailerReady()) {
      console.warn(`[notify] SMTP_USER/SMTP_PASSWORD belum diisi, notifikasi ${reservationId} dilewati`);
      return;
    }

    const row = await loadReservation(reservationId);
    if (!row) return;

    if (!row.outlet) {
      console.warn(`[notify] reservasi ${reservationId} tidak punya outlet — data outlet belum dilengkapi`);
      return;
    }
    if (!row.outlet.is_active || !row.outlet.notify_email) {
      console.warn(`[notify] outlet ${row.outlet.name} tidak aktif atau notify_email kosong, notifikasi ${reservationId} dilewati`);
      return;
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ?? '';
    const notice = buildReservationNotice({
      outletName: row.outlet.name,
      dashboardUrl: `${base}/panel-sanghyang/reservasi`,
      reservation: { ...row, item_name: row.item?.name ?? null },
    });

    await sendMail({ to: row.outlet.notify_email, ...notice });
  } catch (err) {
    console.error(`[notify] notifikasi reservasi ${reservationId} gagal:`, err);
  }
}
