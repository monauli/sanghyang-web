import { NextResponse } from 'next/server';
import { ExelyError, searchRooms } from '@/lib/exely';
import { todayJakarta } from '@/lib/reservation';
import { clientIp, withinRateLimit } from '@/lib/antispam';
import type { RoomOption } from '@/lib/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Endpoint ini publik tapi memanggil Exely dengan kredensial kita. Dua rem:
// jatah per IP, dan cache 60 detik untuk pencarian yang persis sama supaya
// klik "Cek ketersediaan" berulang tidak jadi request berulang ke Exely.
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { rooms: RoomOption[]; at: number }>();

/**
 * Ketersediaan kamar dari Exely. Panggilan ke Exely wajib lewat sini —
 * client_secret tidak boleh sampai ke browser.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get('check_in') ?? '';
  const checkOut = searchParams.get('check_out') ?? '';
  const adults = Number(searchParams.get('adults') ?? '1');

  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ error: 'Tanggal check-in dan check-out tidak valid.' }, { status: 400 });
  }
  if (checkIn < todayJakarta()) {
    return NextResponse.json({ error: 'Tanggal check-in sudah lewat.' }, { status: 400 });
  }
  if (!Number.isInteger(adults) || adults < 1 || adults > 50) {
    return NextResponse.json({ error: 'Jumlah tamu 1–50 orang.' }, { status: 400 });
  }

  if (!withinRateLimit(`exely:${clientIp(request.headers)}`, RATE_MAX, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: 'Terlalu sering mengecek. Tunggu sebentar lalu coba lagi.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const key = `${checkIn}|${checkOut}|${adults}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ rooms: hit.rooms });
  }

  try {
    const rooms = await searchRooms(checkIn, checkOut, adults);
    cache.set(key, { rooms, at: Date.now() });
    if (cache.size > 500) cache.clear(); // ponytail: reset kasar, bukan LRU
    return NextResponse.json({ rooms });
  } catch (err) {
    if (err instanceof ExelyError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('[exely] route gagal:', err);
    return NextResponse.json(
      { error: 'Gagal mengambil ketersediaan kamar. Coba lagi sebentar lagi.' },
      { status: 502 }
    );
  }
}
