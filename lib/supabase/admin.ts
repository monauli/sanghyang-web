import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client service_role — SERVER ONLY, dan hanya untuk operasi yang memang
 * butuh melewati RLS. `service_role` punya BYPASSRLS: setiap query lewat
 * client ini tidak diperiksa policy sama sekali, jadi validasi (lib/reservation.ts)
 * dan saringan bot (lib/antispam.ts) HARUS dijalankan sebelum memanggil ini —
 * tidak ada lagi jaring pengaman di lapisan database untuk jalur ini.
 *
 * Jangan pernah impor file ini dari Client Component atau kirim key-nya ke
 * browser. `import 'server-only'` membuat build gagal kalau itu terjadi.
 */
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[supabase] SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local');
    return null;
  }

  cached ??= createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
