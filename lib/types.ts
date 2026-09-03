export type BookingMethod = 'self_service' | 'exely';

export type Service = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  is_bookable: boolean;
  booking_method: BookingMethod;
};

export type ServiceItem = {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  /** numeric di Postgres — bisa datang sebagai number atau string. */
  price: number | string;
  photo_url: string | null;
  is_active: boolean;
};

export type SiteContent = {
  about_us?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  footer_text?: string;
};

export function formatPrice(price: number | string): string {
  const value = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Satu opsi kamar dari Exely, sudah disederhanakan. Ada di sini (bukan di
 *  lib/exely.ts) supaya Client Component tidak perlu mengimpor modul yang
 *  memegang EXELY_CLIENT_SECRET. */
export type RoomOption = {
  roomTypeId: string;
  name: string;
  mealPlan: string | null;
  total: number;
  currency: string;
  availability: number;
};
