import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { HONEYPOT_FIELD, TOKEN_FIELD } from './antispam.shared.ts';

/**
 * Proteksi bot untuk form reservasi. SERVER ONLY.
 *
 * Tanpa CAPTCHA — tamu resort yang sudah mau memesan tidak pantas disuruh
 * menebak lampu lalu lintas. Tiga lapis yang semuanya tak terlihat oleh
 * pengguna asli, dan semuanya diperiksa di server:
 *
 *   1. Honeypot  — field yang disembunyikan dari mata & screen reader.
 *                  Bot pengisi-semua-field akan mengisinya, manusia tidak.
 *   2. Token     — dibuat server saat form dibuka, ditandatangani HMAC.
 *                  Menolak submit yang tidak pernah membuka form, submit yang
 *                  lebih cepat dari manusia (< 3 detik), dan token basi (> 2 jam).
 *   3. Rate limit— maksimal 5 permintaan per IP per jam.
 *
 * Yang sengaja TIDAK dipakai: CAPTCHA (menyusahkan), blokir user-agent
 * (gampang dipalsukan), dan JS-challenge (merusak aksesibilitas).
 */

export { HONEYPOT_FIELD, TOKEN_FIELD } from './antispam.shared.ts';

const MIN_FILL_MS = 3_000;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function secret(): string {
  const fromEnv = process.env.RESERVATION_FORM_SECRET?.trim();
  if (fromEnv) return fromEnv;

  // Fallback deterministik. Kunci acak per proses TIDAK bisa dipakai di sini:
  // token dibuat di Route Handler dan diverifikasi di Server Action — dua bundle
  // berbeda, jadi variabel modulnya belum tentu sama. Restart server dan deploy
  // multi-instance juga akan mematahkannya.
  //
  // Turunannya dari anon key, yang memang selalu ada. Anon key itu publik, jadi
  // lapisan token di sini hanya menyaring bot yang tidak repot menghitung HMAC —
  // honeypot dan rate limit tetap jalan penuh. Isi RESERVATION_FORM_SECRET kalau
  // mau lapisan ini benar-benar tidak bisa dipalsukan.
  derived ??= createHash('sha256')
    .update(`sanghyang-reservation-form:${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'dev'}`)
    .digest('hex');
  return derived;
}
let derived: string | null = null;

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Token untuk disematkan di form. Dibuat saat form dibuka, bukan saat submit. */
export function createFormToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

function validToken(token: string): boolean {
  const [issuedAt, mac] = token.split('.');
  if (!issuedAt || !mac || !/^\d+$/.test(issuedAt)) return false;

  const expected = sign(issuedAt);
  if (mac.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;

  const age = Date.now() - Number(issuedAt);
  return age >= MIN_FILL_MS && age <= MAX_AGE_MS;
}

// ponytail: rate limit in-memory, jadi hitungannya per-instance dan hilang saat
// restart. Cukup untuk satu server; pindah ke tabel/Redis kalau sudah multi-instance.
const buckets = new Map<string, number[]>();

/**
 * Sliding-window sederhana. `key` sebaiknya "<nama>:<ip>" supaya endpoint
 * yang berbeda tidak saling menghabiskan jatah.
 */
export function withinRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= max) {
    buckets.set(key, recent);
    return false;
  }

  recent.push(now);
  buckets.set(key, recent);

  // Buang kunci yang sudah tidak aktif supaya Map tidak tumbuh selamanya.
  if (buckets.size > 5_000) {
    for (const [k, times] of buckets) {
      if (times.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return true;
}

export type SpamVerdict = { ok: true } | { ok: false; reason: string; message: string };

/**
 * `message` sengaja tidak menjelaskan lapisan mana yang kena — tidak ada
 * gunanya memberi bot umpan balik untuk menyetel serangannya.
 */
export function checkSubmission(formData: FormData, ip: string): SpamVerdict {
  const generic = 'Permintaan tidak bisa diproses. Muat ulang halaman lalu coba lagi.';

  if (String(formData.get(HONEYPOT_FIELD) ?? '').trim() !== '') {
    return { ok: false, reason: 'honeypot', message: generic };
  }

  if (!validToken(String(formData.get(TOKEN_FIELD) ?? ''))) {
    return { ok: false, reason: 'token', message: generic };
  }

  if (!withinRateLimit(`reservasi:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return {
      ok: false,
      reason: 'rate-limit',
      message:
        'Terlalu banyak permintaan dari koneksi ini. Coba lagi nanti, atau hubungi kami langsung lewat telepon.',
    };
  }

  return { ok: true };
}

/**
 * IP klien di balik proxy. Diasumsikan deploy di Vercel: proxy Vercel yang
 * MENULIS ULANG `x-forwarded-for` di edge sebelum masuk ke fungsi kita, jadi
 * klien tidak bisa memalsukannya sendiri untuk mendapat jatah rate-limit baru
 * — nilai pertama di header itu (paling kiri) adalah IP klien asli.
 *
 * Peringatan kalau pindah platform: ini TIDAK aman di belakang proxy yang
 * meneruskan header apa adanya (mis. Node polos tanpa reverse proxy tepercaya)
 * — di situ klien bisa mengisi `x-forwarded-for` miliknya sendiri.
 *
 * Jatuh ke 'unknown' — satu ember bersama, tetap terbatas — bukan gagal keras.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}
