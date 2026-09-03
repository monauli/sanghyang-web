/**
 * Klien Exely — SERVER ONLY. Jangan pernah diimpor dari Client Component:
 * EXELY_CLIENT_SECRET ada di sini.
 *
 * Port dari backend/src/services/{exelyAuth,exelySearch,exelyContent}.js,
 * digabung jadi satu file karena ketiganya cuma dipakai oleh satu route.
 */

import 'server-only';
import type { RoomOption } from './types';

const TOKEN_URL = 'https://connect.hopenapi.com/auth/token';
const SEARCH_BASE = 'https://connect.hopenapi.com/api/search/v1/properties';
const CONTENT_BASE = 'https://connect.hopenapi.com/api/content/v1/properties';

const TOKEN_MARGIN_MS = 30_000;
// Nama tipe kamar praktis tidak pernah berubah.
const NAMES_TTL_MS = 60 * 60 * 1000;

/** Error yang aman ditampilkan ke user (pesannya sudah bahasa Indonesia). */
export class ExelyError extends Error {}

let token: string | null = null;
let tokenExpiry = 0;

function jwtExpiry(jwt: string): number | null {
  try {
    const { exp } = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return exp ? exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiry - TOKEN_MARGIN_MS) return token;

  const clientId = process.env.EXELY_CLIENT_ID;
  const clientSecret = process.env.EXELY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ExelyError('Integrasi kamar belum dikonfigurasi. Hubungi kami lewat telepon.');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[exely] auth gagal (${res.status}):`, text);
    throw new ExelyError('Gagal terhubung ke sistem kamar.');
  }

  let data: { access_token?: string; expires_in?: number };
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[exely] auth: respons bukan JSON:', text);
    throw new ExelyError('Gagal terhubung ke sistem kamar.');
  }
  if (!data.access_token) {
    console.error('[exely] auth: tidak ada access_token:', text);
    throw new ExelyError('Gagal terhubung ke sistem kamar.');
  }

  token = data.access_token;
  tokenExpiry =
    jwtExpiry(token) ??
    (data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 15 * 60 * 1000);
  return token;
}

let namesCache: { names: Record<string, string>; at: number } | null = null;

/**
 * Search API cuma mengirim roomType.id, namanya harus diambil dari Content API.
 * Balikin objek kosong kalau gagal — nama kamar itu pemanis, jangan sampai
 * menggagalkan pencarian.
 */
async function getRoomTypeNames(propertyId: string): Promise<Record<string, string>> {
  if (namesCache && Date.now() - namesCache.at < NAMES_TTL_MS) return namesCache.names;

  try {
    const res = await fetch(`${CONTENT_BASE}/${propertyId}`, {
      headers: { Authorization: `Bearer ${await getToken()}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`content ${res.status}: ${await res.text()}`);

    const content = (await res.json()) as { roomTypes?: { id?: unknown; name?: unknown }[] };
    const names: Record<string, string> = {};
    for (const rt of content.roomTypes ?? []) {
      if (rt.id != null && typeof rt.name === 'string') names[String(rt.id)] = rt.name;
    }
    namesCache = { names, at: Date.now() };
    return names;
  } catch (err) {
    console.error('[exely] getRoomTypeNames gagal:', err);
    return namesCache?.names ?? {};
  }
}

// Exely cuma punya beberapa kode ini; sisanya ditampilkan apa adanya.
const MEAL_PLANS: Record<string, string> = {
  RoomOnly: 'Tanpa sarapan',
  BreakFast: 'Termasuk sarapan',
  HalfBoard: 'Termasuk sarapan & makan malam',
  FullBoard: 'Termasuk semua makan',
};

type RoomStay = {
  roomType?: { id?: unknown };
  mealPlanCode?: string;
  currencyCode?: string;
  availability?: number;
  total?: { priceBeforeTax?: number };
};

export async function searchRooms(
  checkIn: string,
  checkOut: string,
  adults: number
): Promise<RoomOption[]> {
  const propertyId = process.env.EXELY_PROPERTY_ID;
  if (!propertyId) {
    throw new ExelyError('Integrasi kamar belum dikonfigurasi. Hubungi kami lewat telepon.');
  }

  const url = new URL(`${SEARCH_BASE}/${propertyId}/room-stays`);
  url.searchParams.set('arrivalDate', checkIn);
  url.searchParams.set('departureDate', checkOut);
  url.searchParams.set('adults', String(adults));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[exely] search gagal (${res.status}):`, text);
    throw new ExelyError('Sistem kamar sedang tidak bisa dihubungi.');
  }

  let data: { roomStays?: RoomStay[] };
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[exely] search: respons bukan JSON:', text);
    throw new ExelyError('Sistem kamar sedang tidak bisa dihubungi.');
  }

  const names = await getRoomTypeNames(propertyId);

  // fullPlacementsName sengaja tidak dipakai: Exely selalu mengirimnya dalam
  // bahasa Rusia dan Search API tidak punya parameter bahasa.
  return (data.roomStays ?? []).map((stay) => {
    const id = String(stay.roomType?.id ?? '');
    return {
      roomTypeId: id,
      name: names[id] ?? `Kamar ${id || '-'}`,
      mealPlan: stay.mealPlanCode ? (MEAL_PLANS[stay.mealPlanCode] ?? stay.mealPlanCode) : null,
      total: stay.total?.priceBeforeTax ?? 0,
      currency: stay.currencyCode ?? 'IDR',
      availability: stay.availability ?? 0,
    };
  });
}
