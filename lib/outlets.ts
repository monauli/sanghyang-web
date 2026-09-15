import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPayload } from './admin/session';
import type { Outlet } from './types';

export type OutletWithSlug = Outlet & { slug: string };

/** Link yang dipasang sebagai barcode di outlet. Parameter reservasi=1 membuat
 *  form langsung terbuka begitu halaman dibuka. */
export function outletLink(slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ?? '';
  return `${base}/kategori/${slug}?reservasi=1`;
}

export async function listOutletsForSession(
  session: SessionPayload,
  supabase: SupabaseClient
): Promise<OutletWithSlug[]> {
  let query = supabase
    .from('outlets')
    .select('id, service_id, name, notify_email, is_active, service:services(type)')
    .order('name');

  if (session.role === 'captain') query = query.eq('id', session.outletId!);

  const { data, error } = await query;
  if (error) {
    console.error('[outlets] listOutletsForSession:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as Array<Outlet & { service: { type: string } | null }>).map(
    ({ service, ...outlet }) => ({ ...outlet, slug: service?.type ?? '' })
  );
}
