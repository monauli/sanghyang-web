import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client untuk Client Component (jalan di browser).
 * Cuma boleh pakai anon key — key ini memang publik, jadi keamanan datanya
 * bergantung sepenuhnya pada RLS policy di sisi database.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
