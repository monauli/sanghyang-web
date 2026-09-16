import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Service, ServiceItem } from '@/lib/types';

const SERVICE_COLUMNS = 'id, type, name, description, photo_url, is_bookable, booking_method';
const ITEM_COLUMNS = 'id, service_id, name, description, price, photo_url, is_active';

/** Beda dari lib/supabase/queries.ts (halaman publik, pakai anon key): ini
 *  dipakai panel admin lewat service_role, jadi tidak difilter is_active
 *  dsb — owner perlu lihat semuanya. */
export async function listServicesAdmin(supabase: SupabaseClient): Promise<Service[]> {
  const { data, error } = await supabase.from('services').select(SERVICE_COLUMNS).order('name');
  if (error) {
    console.error('[katalog] listServicesAdmin:', error.message);
    return [];
  }
  return (data ?? []) as Service[];
}

export async function getServiceByIdAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<Service | null> {
  const { data, error } = await supabase
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[katalog] getServiceByIdAdmin:', error.message);
    return null;
  }
  return (data as Service | null) ?? null;
}

export async function listItemsByServiceIdAdmin(
  supabase: SupabaseClient,
  serviceId: string
): Promise<ServiceItem[]> {
  const { data, error } = await supabase
    .from('service_items')
    .select(ITEM_COLUMNS)
    .eq('service_id', serviceId)
    .order('name');
  if (error) {
    console.error('[katalog] listItemsByServiceIdAdmin:', error.message);
    return [];
  }
  return (data ?? []) as ServiceItem[];
}

export async function getItemByIdAdmin(
  supabase: SupabaseClient,
  id: string
): Promise<ServiceItem | null> {
  const { data, error } = await supabase
    .from('service_items')
    .select(ITEM_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[katalog] getItemByIdAdmin:', error.message);
    return null;
  }
  return (data as ServiceItem | null) ?? null;
}
