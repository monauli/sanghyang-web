'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminClient } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/admin/password';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/admin/session';

export type LoginState = { error: string | null };

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_ERROR = 'Email atau password salah.';
const LOCKED_ERROR = 'Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.';

type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
};

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return { error: 'Server belum siap. Coba lagi sebentar lagi.' };
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: GENERIC_ERROR };

  const supabase = getAdminClient();
  if (!supabase) return { error: 'Server belum siap. Coba lagi sebentar lagi.' };

  const { data } = await supabase
    .from('admin_users')
    .select('id, email, password_hash, failed_attempts, locked_until')
    .eq('email', email)
    .maybeSingle();
  const admin = data as AdminRow | null;

  if (!admin) return { error: GENERIC_ERROR };

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return { error: LOCKED_ERROR };
  }

  const valid = verifyPassword(password, admin.password_hash);

  if (!valid) {
    const nextAttempts = admin.failed_attempts + 1;
    const locked = nextAttempts >= MAX_FAILED_ATTEMPTS;
    await supabase
      .from('admin_users')
      .update({
        failed_attempts: nextAttempts,
        locked_until: locked
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq('id', admin.id);
    return { error: locked ? LOCKED_ERROR : GENERIC_ERROR };
  }

  await supabase
    .from('admin_users')
    .update({ failed_attempts: 0, locked_until: null })
    .eq('id', admin.id);

  const token = await createSessionToken({ sub: admin.id, email: admin.email });
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect('/panel-sanghyang');
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect('/panel-sanghyang/login');
}
