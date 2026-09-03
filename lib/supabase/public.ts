import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client anon untuk data publik (katalog & konten situs). Tidak menyentuh
 * cookie, jadi bisa dipakai di Server Component maupun `generateStaticParams`
 * — beda dengan client di `server.ts` yang butuh request.
 *
 * Balikin null kalau env belum diisi, supaya halaman tampil dengan empty state
 * alih-alih 500.
 */
let cached: SupabaseClient | null = null;

export function getPublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di .env.local'
    );
    return null;
  }

  cached ??= createSupabaseClient(url, key, { auth: { persistSession: false } });
  return cached;
}
