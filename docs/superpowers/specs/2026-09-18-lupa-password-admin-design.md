# Lupa Password Admin — Design Spec

## Konteks

Panel admin (`/panel-sanghyang`) pakai login email+password (scrypt hash,
`admin_users` table, lihat `db/005_admin_users.sql`). Belum ada cara admin
reset password sendiri kalau lupa — satu-satunya jalan sekarang adalah minta
developer jalankan `UPDATE admin_users SET password_hash = ...` manual di
Supabase (dipakai waktu ganti email owner ke `hotel.sanghyang@gmail.com`).

Fitur ini menambah alur self-service: request reset via email → klik link →
set password baru. Reuse infrastruktur email yang sudah ada
(`lib/notify/mailer.ts`, SMTP Gmail) — infra yang sama dipakai notifikasi
captain, `SMTP_USER`/`SMTP_PASSWORD` belum diisi di `.env.local` (lihat
CLAUDE.md, "Setup manual Checkpoint 2"). Fitur ini bisa diimplementasikan dan
dites logikanya sekarang; jalur emailnya baru aktif nyata setelah SMTP
diisi.

## Scope

**Termasuk:**
- Halaman `/panel-sanghyang/lupa-password` — form email, kirim link reset
- Tabel `admin_password_resets` — token (hashed), expiry, status pakai
- Halaman `/panel-sanghyang/reset-password?token=...` — form password baru
- Email reset via `mailer.ts` yang sudah ada
- Rate limit request (cegah spam email ke satu alamat)
- Anti-enumeration: response request selalu sama, gak bocorin apakah email
  terdaftar

**Tidak termasuk:**
- Ubah alur login yang sudah ada
- Ubah SMTP/mailer.ts itu sendiri
- UI/halaman lain di luar dua halaman baru ini

## Data Model

```sql
create table public.admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null,          -- scrypt hash token asli, sama pola dengan password
  expires_at timestamptz not null,   -- created_at + 30 menit
  used_at timestamptz,               -- null = belum dipakai
  created_at timestamptz not null default now()
);

grant select, insert, update on public.admin_password_resets to service_role;
```

- Token asli (random, `crypto.randomUUID()` atau setara — 32+ byte) cuma
  dikirim lewat email, dihash sebelum simpan ke DB (pola sama seperti
  password: jangan simpan token polos, kalau DB bocor token gak bisa dipakai
  langsung).
- Token valid 30 menit sejak dibuat.
- Token sekali pakai — `used_at` diisi begitu password berhasil diganti.
- Tidak ada `on delete cascade` masalah karena tiap `admin_users` row bisa
  punya banyak token history (gak perlu dibersihkan, tabel kecil).

## Alur

### 1. Request reset (`/panel-sanghyang/lupa-password`)

- Form: input email, tombol submit.
- Server Action `mintaReset(email)`:
  1. Rate limit: max 3 request per email per jam (query count token dibuat
     dalam 1 jam terakhir untuk `admin_user_id` itu — kalau email gak
     ketemu, skip cek ini, langsung ke langkah 4).
  2. Cari `admin_users` by email. Kalau gak ketemu → lanjut ke langkah 4
     tanpa ngapa-ngapain (anti-enumeration).
  3. Kalau ketemu: generate token, hash, insert ke
     `admin_password_resets`, kirim email berisi link
     `${SITE_URL}/panel-sanghyang/reset-password?token=<token asli>`.
     Email gagal kirim → catat log, tetap lanjut (jangan expose ke user).
  4. Selalu return sukses: "Kalau email terdaftar, link reset sudah
     dikirim. Cek inbox (dan folder spam)."

### 2. Reset password (`/panel-sanghyang/reset-password?token=...`)

- Halaman baca token dari query param, render form password baru
  (password + konfirmasi password).
- Server Action `resetPassword(token, passwordBaru)`:
  1. Hash token yang dikirim, cari row `admin_password_resets` yang cocok
     hash-nya, `used_at is null`, `expires_at > now()`.
  2. Gak ketemu / expired / udah dipakai → error: "Link reset gak valid
     atau sudah kedaluwarsa. Minta link baru."
  3. Validasi password baru (aturan sama seperti bikin akun:
     `scripts/create-admin.ts` — cek panjang minimal, lihat
     `lib/admin/password.ts` untuk aturan hashing yang sudah ada).
  4. Update `admin_users.password_hash`, reset `failed_attempts = 0`,
     `locked_until = null`.
  5. Tandai token `used_at = now()`.
  6. Redirect ke `/panel-sanghyang/login` dengan pesan sukses.

## Keamanan

- **Anti-enumeration**: response request reset selalu identik entah email
  terdaftar atau tidak. Timing juga harus konsisten — kalau email gak
  ketemu, tetap jalanin hash dummy sebentar biar gak ketebak dari waktu
  respons (pola yang sama kayak anti-enumeration login yang sudah ada,
  lihat `lib/admin/auth.ts`).
- **Token tidak pernah disimpan polos** — sama prinsip dengan password.
- **Token sekali pakai + expired 30 menit** — window serangan kecil.
- **Rate limit per email** — cegah spam kirim email berkali-kali ke satu
  alamat (bisa dipakai buat harass orang lain kalau gak dibatasi).
- Reset password sukses **tidak** otomatis logout sesi admin itu di device
  lain (JWT session lama tetap jalan sampai expired sendiri) — di luar
  scope ini, sama seperti sekarang gak ada mekanisme "logout semua device".
  Dicatat sebagai keterbatasan, bukan bug.

## Error Handling

- SMTP belum diisi (`mailerReady()` false): request tetap diproses (token
  dibuat), tapi kirim email di-skip + log warning — user tetap dapat
  respons sukses generik (gak expose status SMTP internal ke UI).
- Token invalid/expired/used: pesan sama rata ("link gak valid/kedaluwarsa"),
  gak dibedakan supaya gak bocorin info token attacker.
- Password baru gak valid (terlalu pendek dll): tampilkan pesan error
  spesifik di form (ini bukan soal enumeration, jadi boleh spesifik).

## Testing

- Unit test (`node --test`) untuk logika token: generate, hash, verify,
  expiry check — file baru `scripts/admin-password-reset.test.ts`.
- Manual test checklist (dijalankan setelah SMTP diisi):
  1. Request reset pakai email admin valid → email masuk (cek spam)
  2. Klik link → set password baru → berhasil login pakai password baru
  3. Request reset pakai email gak terdaftar → pesan sama, gak ada email
     terkirim (gak ada cara verifikasi ini dari UI, tapi log server harus
     nunjukin di-skip)
  4. Coba pakai token yang sama dua kali → gagal di percobaan kedua
  5. Coba token lewat 30 menit → gagal (bisa dites dengan set expires_at
     manual ke masa lalu di SQL Editor)
