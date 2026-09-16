'use server';

import { revalidatePath } from 'next/cache';
import { requireScopedClient } from '@/lib/admin/scope';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

const KEYS = ['about_us', 'contact_phone', 'contact_email', 'contact_address', 'footer_text'] as const;

export async function simpanKonten(formData: FormData): Promise<void> {
  const { session, supabase } = await requireScopedClient();

  // Konten ini tampil di semua halaman publik, bukan milik satu outlet —
  // cuma owner yang boleh mengubahnya.
  if (session.role !== 'owner') {
    console.warn(`[admin] ${session.email} (captain) mencoba mengubah site_content`);
    return;
  }

  const email = String(formData.get('contact_email') ?? '').trim();
  if (email !== '' && !EMAIL_RE.test(email)) return;

  const rows = KEYS.map((key) => ({ key, value: String(formData.get(key) ?? '').trim() }));
  await supabase.from('site_content').upsert(rows, { onConflict: 'key' });

  revalidatePath('/panel-sanghyang/konten');
  revalidatePath('/');
  revalidatePath('/tentang-kami');
  revalidatePath('/kontak');
  revalidatePath('/reservasi/terkirim');
}
