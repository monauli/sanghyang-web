import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase client untuk Server Component / Route Handler / Server Action.
 * Harus dibuat baru per request — jangan disimpan di variabel modul, karena
 * cookie-nya beda tiap user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component: cookie read-only di sini.
            // Aman diabaikan selama refresh session ditangani middleware.
          }
        },
      },
    }
  );
}
