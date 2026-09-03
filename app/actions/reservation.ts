'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  echoValues,
  parseReservationForm,
  type EchoValues,
  type FieldErrors,
} from '@/lib/reservation';
import { checkSubmission, clientIp } from '@/lib/antispam';

export type ReservationState = { errors: FieldErrors; values?: EchoValues };

export async function submitReservation(
  _prev: ReservationState,
  formData: FormData
): Promise<ReservationState> {
  // Saringan bot dulu: honeypot + token + rate limit, semuanya di server.
  // Dikembalikan bersama setiap error supaya isian tamu tidak hilang: React
  // mereset form setelah Server Action selesai, jadi defaultValue-nya harus
  // datang dari sini.
  const values = echoValues(formData);

  const spam = checkSubmission(formData, clientIp(await headers()));
  if (!spam.ok) {
    console.warn(`[antispam] submit ditolak (${spam.reason})`);
    return { errors: { form: spam.message }, values };
  }

  // Validasi server: form bisa saja dikirim tanpa lewat browser kita.
  const parsed = parseReservationForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values };

  // service_role, bukan anon: anon sudah tidak punya hak INSERT sama sekali
  // (lihat web/db/003_reservation_requests_revoke_anon.sql) supaya satu-satunya
  // jalan masuk ke tabel ini adalah lewat Server Action ini — tempat honeypot,
  // token, dan rate limit di atas benar-benar diperiksa.
  const supabase = getAdminClient();
  if (!supabase) return { errors: { form: 'Server belum siap menerima reservasi.' }, values };

  const { error } = await supabase.from('reservation_requests').insert(parsed.data);

  if (error) {
    console.error('[supabase] submitReservation:', error.message);
    return {
      errors: {
        form: 'Permintaan gagal dikirim. Coba lagi sebentar lagi, atau hubungi kami langsung.',
      },
      values,
    };
  }

  redirect('/reservasi/terkirim');
}
