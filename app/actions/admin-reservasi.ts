'use server';

import { revalidatePath } from 'next/cache';
import { canAccessService, requireScopedClient } from '@/lib/admin/scope';

const STATUSES = ['baru', 'dihubungi', 'dikonfirmasi', 'batal'] as const;

export async function ubahStatus(formData: FormData): Promise<void> {
  const { session, supabase } = await requireScopedClient();

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;

  // Baca dulu service_id-nya, lalu periksa terhadap sesi. Jangan percaya
  // apa pun yang datang dari form: id bisa diganti manual.
  const { data } = await supabase
    .from('reservation_requests')
    .select('id, service_id')
    .eq('id', id)
    .maybeSingle();

  if (!data || !canAccessService(session, (data as { service_id: string }).service_id)) {
    console.warn(`[admin] ${session.email} mencoba mengubah reservasi di luar jangkauannya: ${id}`);
    return;
  }

  await supabase.from('reservation_requests').update({ status }).eq('id', id);
  revalidatePath('/panel-sanghyang/reservasi');
}
