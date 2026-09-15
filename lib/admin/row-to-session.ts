import type { SessionPayload } from './session.ts';

export type AdminRowWithOutlet = {
  id: string;
  email: string;
  outlet_id: string | null;
  outlet: { id: string; service_id: string } | null;
};

/**
 * Baris admin_users (dengan outlet hasil join) -> payload sesi.
 *
 * Mengembalikan null kalau barisnya tidak konsisten. Perhatikan kasus
 * outlet_id terisi tapi outletnya tidak ada: itu TIDAK boleh diperlakukan
 * sebagai pemilik, karena artinya captain mendadak bisa melihat semua outlet.
 */
export function sessionFromAdminRow(row: AdminRowWithOutlet): SessionPayload | null {
  if (row.outlet_id === null) {
    return { sub: row.id, email: row.email, role: 'owner', outletId: null, serviceId: null };
  }

  if (!row.outlet || row.outlet.id !== row.outlet_id) return null;

  return {
    sub: row.id,
    email: row.email,
    role: 'captain',
    outletId: row.outlet.id,
    serviceId: row.outlet.service_id,
  };
}
