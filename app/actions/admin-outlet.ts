'use server';

import { revalidatePath } from 'next/cache';
import { requireScopedClient } from '@/lib/admin/scope';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

export async function simpanNotifyEmail(formData: FormData): Promise<void> {
  const { session, supabase } = await requireScopedClient();

  const outletId = String(formData.get('outlet_id') ?? '');
  const raw = String(formData.get('notify_email') ?? '').trim();
  if (!outletId) return;

  // Captain hanya boleh mengubah outletnya sendiri. Nilainya diambil dari
  // sesi, jadi id di form tidak bisa dipakai menjangkau outlet lain.
  if (session.role === 'captain' && outletId !== session.outletId) {
    console.warn(`[admin] ${session.email} mencoba mengubah notify_email outlet lain: ${outletId}`);
    return;
  }

  const email = raw === '' ? null : raw;
  if (email !== null && !EMAIL_RE.test(email)) return;

  await supabase.from('outlets').update({ notify_email: email }).eq('id', outletId);
  revalidatePath('/panel-sanghyang/pengaturan');
}
