'use server';

import { revalidatePath } from 'next/cache';
import { requireScopedClient } from '@/lib/admin/scope';
import { verifyPassword } from '@/lib/admin/password';

export type GantiEmailState = { error: string | null; success: boolean };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

export async function gantiEmail(
  _prev: GantiEmailState,
  formData: FormData
): Promise<GantiEmailState> {
  const { session, supabase } = await requireScopedClient();

  const emailBaru = String(formData.get('email_baru') ?? '').trim().toLowerCase();
  const passwordSekarang = String(formData.get('password_sekarang') ?? '');

  if (!EMAIL_RE.test(emailBaru)) {
    return { error: 'Email tidak valid.', success: false };
  }

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, password_hash')
    .eq('id', session.sub)
    .maybeSingle();

  if (!admin || !verifyPassword(passwordSekarang, admin.password_hash)) {
    return { error: 'Password sekarang salah.', success: false };
  }

  if (emailBaru === session.email) {
    return { error: 'Email baru sama dengan email sekarang.', success: false };
  }

  const { data: dipakai } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', emailBaru)
    .maybeSingle();

  if (dipakai) {
    return { error: 'Email sudah dipakai akun lain.', success: false };
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ email: emailBaru })
    .eq('id', session.sub);

  if (error) return { error: `Gagal menyimpan: ${error.message}`, success: false };

  revalidatePath('/panel-sanghyang/pengaturan');
  return { error: null, success: true };
}
