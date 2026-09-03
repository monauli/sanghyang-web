import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from './session';

/**
 * Panggil di baris pertama tiap Server Action / Route Handler di bawah
 * /panel-sanghyang. middleware.ts menangani redirect untuk halaman, tapi
 * Server Action & Route Handler tetap wajib cek sendiri — jangan asumsikan
 * middleware selalu jalan duluan untuk setiap kemungkinan jalur eksekusi.
 */
export async function requireAdminSession(): Promise<SessionPayload> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) redirect('/panel-sanghyang/login');
  return session;
}
