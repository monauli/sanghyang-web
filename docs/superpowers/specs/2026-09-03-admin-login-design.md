# Sistem Login Admin — Fase 6 Checkpoint 1

Status: disetujui, siap implementasi.

## Konteks & tujuan

Fase 6 membangun admin dashboard di `/panel-sanghyang` supaya staff resort bisa
ganti foto, harga, dan konten tanpa perlu paham teknis (redeploy, git, dll).
Ini adalah checkpoint pertama dari beberapa checkpoint: sistem login. Dashboard
sungguhan (ringkasan reservasi, kelola katalog, kelola konten) adalah checkpoint
terpisah yang menyusul setelah ini.

Versi lama (`backend/src/middleware/adminAuth.js`) pakai Basic Auth dengan satu
akun hardcode dari env var (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), tanpa hashing, tanpa
rate limit. Checkpoint ini menggantinya dengan sistem login session-based yang
proper: tabel `admin_users` dengan password di-hash, cookie sesi httpOnly, dan
rate limit percobaan login.

## Keputusan desain (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Verifikasi sesi | `middleware.ts` (Edge Runtime) + `jose` | Satu tempat proteksi, otomatis mencakup halaman, Server Action, dan Route Handler di bawah `/panel-sanghyang/*`. Edge Runtime tidak punya modul `crypto` Node, jadi butuh `jose` untuk verifikasi JWT. |
| Hash password | `crypto.scryptSync` (bawaan Node) | Zero dependency baru, algoritma teruji untuk password hashing. |
| Rate limit | Kolom `failed_attempts` + `locked_until` di `admin_users` | Staff internal, jumlah akun kecil — tidak perlu tabel audit terpisah. |
| Durasi sesi | 8 jam | Cukup untuk satu hari kerja, tidak perlu login ulang di tengah hari. |
| Bootstrap akun pertama | Script CLI (`scripts/create-admin.ts`) | Tidak ada halaman signup publik; script generate hash + SQL INSERT siap-tempel, dijalankan sekali secara lokal. |

Dependency baru: **`jose`** saja.

## Skema database

`web/db/005_admin_users.sql` — **ditulis, TIDAK dijalankan** sampai user review
dan jalankan manual di Supabase SQL Editor (pola yang sama seperti migrasi 001-004).

```sql
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
```

- Tidak ada RLS policy atau GRANT untuk `anon`/`authenticated` — default-deny.
  Tabel ini hanya disentuh lewat `service_role` di server (pola sama seperti
  `reservation_requests`, lihat `web/db/003_reservation_requests_revoke_anon.sql`).
- `password_hash` format `scrypt:<salt-hex>:<hash-hex>` — salt unik per baris,
  digabung dalam satu string supaya tidak perlu kolom terpisah.
- Tidak ada kolom `role` — semua admin setara untuk sekarang (YAGNI).

## Alur login

1. Staff buka `/panel-sanghyang/login`, isi email + password.
2. Server Action `login(formData)` di `web/app/actions/admin-auth.ts`:
   a. Cari baris `admin_users` by email (service_role client).
   b. Kalau tidak ketemu **ATAU** `locked_until` masih di masa depan → treat
      sebagai gagal (lanjut ke langkah d) tanpa membedakan pesan — mencegah
      enumerasi email admin yang valid.
   c. Verifikasi password dengan `verifyPassword(password, password_hash)`
      (timing-safe, lewat `crypto.timingSafeEqual` pada hasil scrypt).
   d. **Gagal**: increment `failed_attempts`. Kalau hasil incrementnya
      mencapai 5, set `locked_until = now() + interval '15 minutes'`.
      Kembalikan pesan generik: "Email atau password salah."
   e. **Berhasil**: reset `failed_attempts = 0, locked_until = null`, buat
      JWT (`createSessionToken({ sub: admin.id, email: admin.email })`,
      HS256, `exp` 8 jam dari sekarang, secret dari `ADMIN_SESSION_SECRET`),
      set sebagai cookie `sanghyang_admin_session` (httpOnly, secure,
      sameSite=lax, path=/, maxAge 8 jam). Redirect ke `/panel-sanghyang`.
3. `middleware.ts`, matcher `/panel-sanghyang/:path*`:
   - Request ke `/panel-sanghyang/login` → biarkan lewat (tidak boleh infinite
     redirect loop). Kalau cookie sesi valid ada dan user buka halaman ini,
     redirect ke `/panel-sanghyang` (sudah login, tidak perlu login lagi).
   - Request ke path lain di bawah `/panel-sanghyang/*` → verifikasi cookie
     via `verifySessionToken()`. Tidak ada / tidak valid / kadaluarsa →
     redirect ke `/panel-sanghyang/login`.
4. Logout: Server Action `logout()` — hapus cookie (`cookies().delete(...)`),
   redirect ke `/panel-sanghyang/login`.

**Catatan: verifikasi stateless.** `verifySessionToken()` di middleware hanya
memeriksa tanda tangan & `exp` JWT — tidak query database. Ini disengaja
(Edge Runtime + tanpa panggilan network tambahan tiap request = cepat), tapi
konsekuensinya: tidak ada mekanisme "paksa logout semua sesi" sebelum token
kadaluarsa (mis. kalau akun admin dihapus, sesi yang sudah terlanjur aktif
tetap valid sampai 8 jam habis). Untuk jumlah admin kecil & internal, ini
trade-off yang wajar — dicatat di sini supaya bukan kejutan nanti, bukan
sesuatu yang perlu diperbaiki sekarang (YAGNI).

### Kenapa validasi dobel (middleware + helper di Server Action)?

`middleware.ts` menangani proteksi *halaman* (redirect kalau belum login).
Tapi Server Action & Route Handler checkpoint-checkpoint berikutnya (simpan
katalog, upload foto, dll) tetap **wajib** memanggil helper
`requireAdminSession()` (di `web/lib/admin/auth.ts`) di baris pertama fungsi
masing-masing — defense in depth, jangan asumsikan middleware selalu jalan
duluan untuk setiap kemungkinan jalur eksekusi. Checkpoint ini hanya
menyediakan helper-nya; checkpoint berikutnya yang memakainya.

## Struktur file

```
web/db/005_admin_users.sql              SQL tabel admin_users (review dulu, belum dijalankan)
web/lib/admin/password.ts               hashPassword(), verifyPassword()
web/lib/admin/session.ts                createSessionToken(), verifySessionToken() (jose)
web/lib/admin/auth.ts                   requireAdminSession() — helper untuk Server Action/Route Handler
web/middleware.ts                       proteksi route + redirect
web/app/panel-sanghyang/login/page.tsx  halaman login (form, Bahasa Indonesia)
web/app/actions/admin-auth.ts           Server Action login() & logout()
web/app/panel-sanghyang/page.tsx        placeholder ("Berhasil login — dashboard menyusul")
web/scripts/create-admin.ts             CLI bootstrap akun pertama
web/.env.example                        + ADMIN_SESSION_SECRET (baris baru, kosong)
```

## Environment variable baru

`ADMIN_SESSION_SECRET` — string acak panjang (server-only, bukan `NEXT_PUBLIC_`),
dipakai untuk menandatangani JWT sesi. Perlu diisi di `.env.local` (lokal) dan
Vercel dashboard (production) sebelum login bisa berfungsi.

## Testing

- `web/scripts/admin-auth.test.ts` (pola sama seperti
  `scripts/antispam.test.ts` / `scripts/reservation.test.ts`, `node --test`):
  - `hashPassword` + `verifyPassword`: hash password benar → verify sukses;
    password salah → verify gagal; dua hash dari password sama harus beda
    (salt unik).
  - `createSessionToken` + `verifySessionToken`: token valid → payload benar;
    token kadaluarsa → verifikasi gagal; token dengan secret berbeda → gagal.
- Manual end-to-end (tidak otomatis, dicek langsung setelah implementasi):
  login gagal 5x → terkunci → tunggu/reset → login benar → redirect dashboard
  placeholder → akses `/panel-sanghyang` tanpa cookie → redirect ke login →
  logout → cookie hilang.

## Di luar scope checkpoint ini

Dashboard sungguhan, kelola katalog, kelola konten, tombol revalidate manual —
semua itu checkpoint terpisah yang menyusul. Ganti password / lupa password
juga di luar scope (belum diminta — YAGNI).
