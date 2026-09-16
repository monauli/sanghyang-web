import { getPublicClient } from './public';
import type { Service, ServiceItem, SiteContent } from '../types';

const SERVICE_COLUMNS = 'id, type, name, description, photo_url, is_bookable, booking_method';
const ITEM_COLUMNS = 'id, service_id, name, description, price, photo_url, is_active';

/**
 * Semua query di sini sengaja tidak melempar error: halaman publik lebih baik
 * tampil dengan section kosong daripada 500. Errornya di-log ke konsol server
 * (kelihatan di `npm run dev`) — penyebab paling umum adalah env belum diisi,
 * atau role anon belum dapat GRANT SELECT + RLS policy di Supabase.
 */
function logError(where: string, error: { message: string } | null) {
  if (error) console.error(`[supabase] ${where}: ${error.message}`);
}

export async function getServices(): Promise<Service[]> {
  const supabase = getPublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from('services').select(SERVICE_COLUMNS).order('name');
  logError('getServices', error);
  return (data as Service[] | null) ?? [];
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const supabase = getPublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('type', slug)
    .maybeSingle();
  logError('getServiceBySlug', error);
  return (data as Service | null) ?? null;
}

export async function getItemsByServiceId(serviceId: string): Promise<ServiceItem[]> {
  const supabase = getPublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('service_items')
    .select(ITEM_COLUMNS)
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .order('name');
  logError('getItemsByServiceId', error);
  return (data as ServiceItem[] | null) ?? [];
}

/** Dipakai halaman galeri: sekali query untuk banyak kategori. */
export async function getItemsByServiceIds(serviceIds: string[]): Promise<ServiceItem[]> {
  const supabase = getPublicClient();
  if (!supabase || serviceIds.length === 0) return [];

  const { data, error } = await supabase
    .from('service_items')
    .select(ITEM_COLUMNS)
    .in('service_id', serviceIds)
    .eq('is_active', true)
    .order('name');
  logError('getItemsByServiceIds', error);
  return (data as ServiceItem[] | null) ?? [];
}

/**
 * Foto slideshow hero Home — kurasi manual, bukan ambil sembarang kategori,
 * supaya campuran suasananya konsisten (kamar, DBC malam, kolam, spa).
 * Kategori yang fotonya kosong dilewat, bukan bikin error — slideshow tetap
 * jalan dengan foto yang ada, walau cuma tersisa satu.
 */
const HERO_SLIDE_TYPES = ['rooms', 'dragon-beach-club', 'swimming-pool', 'd-spa'];

export async function getHeroPhotos(): Promise<string[]> {
  const supabase = getPublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('services')
    .select('type, photo_url')
    .in('type', HERO_SLIDE_TYPES);
  logError('getHeroPhotos', error);

  const byType = new Map(
    ((data as { type: string; photo_url: string | null }[] | null) ?? []).map((s) => [
      s.type,
      s.photo_url,
    ])
  );
  return HERO_SLIDE_TYPES.map((t) => byType.get(t)).filter((url): url is string => Boolean(url));
}

export async function getSiteContent(): Promise<SiteContent> {
  const supabase = getPublicClient();
  if (!supabase) return {};

  const { data, error } = await supabase.from('site_content').select('key, value');
  logError('getSiteContent', error);

  const rows = (data as { key: string; value: string }[] | null) ?? [];
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as SiteContent;
}
