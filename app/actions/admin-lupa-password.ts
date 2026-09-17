'use server';

import { getAdminClient } from '@/lib/supabase/admin';
import {
  generateResetToken,
  hashResetToken,
  resetTokenExpiresAt,
  verifyResetToken,
  isResetTokenExpired,
} from '@/lib/admin/password-reset';
import { hashPassword } from '@/lib/admin/password';
import { sendPasswordResetEmail } from '@/lib/notify/password-reset-email';

export type MintaResetState = { message: string | null };

const GENERIC_MESSAGE =
  'Kalau email terdaftar, link reset sudah dikirim. Cek inbox (dan folder spam).';
const RATE_LIMIT_PER_HOUR = 3;

export async function mintaReset(
  _prev: MintaResetState,
  formData: FormData
): Promise<MintaResetState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { message: GENERIC_MESSAGE };

  const supabase = getAdminClient();
  if (!supabase) return { message: GENERIC_MESSAGE };

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (!admin) return { message: GENERIC_MESSAGE };

  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from('admin_password_resets')
    .select('id', { count: 'exact', head: true })
    .eq('admin_user_id', admin.id)
    .gte('created_at', oneHourAgo);

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) return { message: GENERIC_MESSAGE };

  const token = generateResetToken();
  const { error } = await supabase.from('admin_password_resets').insert({
    admin_user_id: admin.id,
    token_hash: hashResetToken(token),
    expires_at: resetTokenExpiresAt(),
  });

  if (!error) {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ?? '';
    const resetLink = `${base}/panel-sanghyang/reset-password?token=${token}`;
    await sendPasswordResetEmail(admin.email, resetLink);
  }

  return { message: GENERIC_MESSAGE };
}

export type ResetPasswordState = { error: string | null; success: boolean };

const TOKEN_INVALID_ERROR = 'Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.';

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!token || !password) return { error: TOKEN_INVALID_ERROR, success: false };
  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.', success: false };
  }

  const supabase = getAdminClient();
  if (!supabase) return { error: TOKEN_INVALID_ERROR, success: false };

  const { data: candidates } = await supabase
    .from('admin_password_resets')
    .select('id, admin_user_id, token_hash, expires_at, used_at')
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString());

  const match = (candidates ?? []).find((row) => verifyResetToken(token, row.token_hash));
  if (!match) return { error: TOKEN_INVALID_ERROR, success: false };
  if (isResetTokenExpired(match.expires_at)) {
    return { error: TOKEN_INVALID_ERROR, success: false };
  }

  await supabase
    .from('admin_users')
    .update({ password_hash: hashPassword(password), failed_attempts: 0, locked_until: null })
    .eq('id', match.admin_user_id);

  await supabase
    .from('admin_password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', match.id);

  return { error: null, success: true };
}
