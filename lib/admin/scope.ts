import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '../supabase/admin.ts';
import type { SessionPayload } from './session.ts';

/**
 * Satu-satunya tempat pemisahan data antar outlet ditegakkan.
 *
 * Panel admin memakai service_role yang menembus RLS (lihat
 * lib/supabase/admin.ts), jadi policy database tidak menolong di jalur ini.
 * Aturannya: TIDAK ADA Server Action / Route Handler admin yang memanggil
 * getAdminClient() langsung untuk data reservasi — semuanya lewat sini.
 *
 * Filter selalu berasal dari sesi, bukan dari request. Captain yang mengubah
 * URL atau id di request tetap tidak bisa menjangkau outlet lain.
 */

export function canAccessService(session: SessionPayload, serviceId: string): boolean {
  if (session.role === 'owner') return true;
  if (!serviceId) return false;
  return session.serviceId === serviceId;
}

export async function requireScopedClient(): Promise<{
  session: SessionPayload;
  supabase: SupabaseClient;
}> {
  // Impor dinamis: auth.ts menarik next/headers & next/navigation, yang
  // tidak bisa dimuat langsung oleh `node --test` (lihat scripts/admin-scope.test.ts).
  // Dengan impor dinamis, modul ini tetap bisa diuji tanpa runtime Next.js,
  // tapi tetap satu-satunya jalur nyata di Server Action/Route Handler.
  const { requireAdminSession } = await import('./auth.ts');
  const session = await requireAdminSession();
  const supabase = getAdminClient();
  if (!supabase) throw new Error('Supabase admin client belum siap (env belum diisi)');
  return { session, supabase };
}

const RESERVATION_COLUMNS =
  'id, customer_name, customer_email, customer_phone, service_id, service_item_id, ' +
  'reservation_date, checkout_date, guests, notes, status, created_at';

/** Query reservation_requests yang sudah tersaring sesuai sesi. */
export function reservationQuery(session: SessionPayload, supabase: SupabaseClient) {
  const query = supabase.from('reservation_requests').select(RESERVATION_COLUMNS);
  return session.role === 'owner' ? query : query.eq('service_id', session.serviceId);
}
