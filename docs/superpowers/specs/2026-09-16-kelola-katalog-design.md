# Kelola Katalog — Design Spec

**Tanggal:** 2026-09-16
**Status:** Disetujui, siap dibuat rencana implementasi

## Latar belakang

Fase 6B. Saat ini kategori (`services`, 15 baris) dan item (`service_items`,
35 baris) cuma bisa diubah lewat Supabase Table Editor langsung. Ini fitur
dashboard di `/panel-sanghyang/katalog` supaya owner bisa kelola sendiri
tanpa buka Supabase.

## Tujuan

- Owner bisa **tambah** dan **edit** kategori (nama, deskripsi, foto, status
  bisa-direservasi)
- Owner bisa **tambah** dan **edit** item di dalam kategori (nama,
  deskripsi, harga, foto)
- Upload foto langsung ke Supabase Storage, bukan tempel URL manual
- Perubahan tampil di halaman publik segera (`revalidatePath`), tidak nunggu
  cache 300 detik

## Di luar cakupan (disepakati lewat brainstorming)

- **Hapus kategori atau item** — tidak ada tombol hapus sama sekali di versi
  ini. (Item sebenarnya sudah punya kolom `is_active` untuk soft-delete di
  skema, tapi UI untuk itu tidak dibangun sekarang — YAGNI, bisa ditambah
  nanti kalau kebutuhannya muncul.)
- **Ubah slug (`services.type`) kategori yang sudah ada** — slug dipakai di
  URL publik (`/kategori/<slug>`) dan tersebar di link yang mungkin sudah
  dibagi ke customer; mengubahnya berisiko merusak link lama. Slug kategori
  baru dibuat otomatis sekali saat create, lalu dikunci (read-only)
  selamanya.
- **Booking method "Exely"** untuk kategori baru — itu khusus alur Rooms
  yang terintegrasi channel manager; kategori baru cuma bisa
  `self_service` atau tidak bisa direservasi sama sekali.
- **Auto-provision outlet** (captain, notifikasi email) untuk kategori
  self-service baru — itu tetap langkah manual terpisah lewat SQL, sama
  seperti 5 outlet yang ada sekarang. Dashboard cukup kasih catatan di UI.
- **Import Excel Exely** — item terpisah di roadmap Fase 6B, bukan bagian
  spec ini.

## Data model

Tidak ada migration skema baru untuk tabel — `services` dan `service_items`
sudah punya semua kolom yang dibutuhkan (lihat `lib/types.ts`). Satu-satunya
infrastruktur baru: **Supabase Storage bucket** bernama `katalog`.

```sql
-- db/010_katalog_storage.sql
insert into storage.buckets (id, name, public)
values ('katalog', 'katalog', true)
on conflict (id) do nothing;

-- Baca publik (foto tampil di web tanpa auth)
create policy "Baca publik bucket katalog"
on storage.objects for select
using (bucket_id = 'katalog');

-- Tulis/ubah/hapus hanya lewat service_role (dipakai Server Action),
-- tidak ada policy insert/update/delete untuk anon/authenticated.
```

## Arsitektur

Pola sama persis dengan Kelola Konten & Pengaturan Outlet yang sudah ada:
Server Component ambil data lewat `requireScopedClient()` (owner-only,
sama seperti `/panel-sanghyang/konten`), form Client Component manggil
Server Action, `revalidatePath()` di akhir.

### Halaman

- `/panel-sanghyang/katalog` — list 15 kategori (nama, foto kecil, status
  bisa-direservasi), tombol "Tambah kategori", link ke tiap kategori
- `/panel-sanghyang/katalog/[id]` — form edit kategori + list item di
  dalamnya + tombol "Tambah item"
- `/panel-sanghyang/katalog/[id]/item/[itemId]` — form edit satu item

### Server Actions (`app/actions/admin-katalog.ts`)

- `simpanKategori(formData)` — create atau update tergantung ada `id` atau
  tidak. Create: generate slug dari nama (`slugify`, lowercase, spasi→`-`,
  buang karakter aneh), cek tabrakan dengan slug yang sudah ada (tambah
  angka di belakang kalau tabrakan, mis. `kids-club-2`). Update: `type`
  tidak pernah diikutkan di payload update (dikunci).
- `simpanItem(formData)` — create atau update `service_items`, validasi
  `price` numeric ≥ 0.
- `uploadFotoKatalog(formData)` — terima file (sudah dikompresi di
  browser), upload ke bucket `katalog` dengan nama acak
  (`crypto.randomUUID()` + ekstensi), return public URL. Dipanggil dari
  dalam `simpanKategori` / `simpanItem` sebagai langkah internal, bukan
  action terpisah yang dipanggil form (form kirim file + data sekaligus
  dalam satu submit). Foto lama dihapus dari Storage HANYA kalau URL
  lamanya memang dari bucket `katalog` (dicek prefix URL-nya) — 15
  kategori & 35 item yang ada sekarang fotonya masih di domain lama
  (`sanghyang.com`), jadi untuk itu tidak ada yang dihapus, cuma
  diganti nilainya di database.

Semua action: `requireScopedClient()` → tolak kalau `session.role !==
'owner'` (pola sama seperti `admin-konten.ts`).

### Upload foto — alur lengkap

1. **Browser (Client Component):** user pilih file di `<input type="file"
   accept="image/*">`. `onChange` langsung proses lewat `<canvas>`: gambar
   digambar ke canvas dengan lebar maks 1600px (tinggi menyesuaikan rasio),
   lalu `canvas.toBlob(..., 'image/webp', 0.8)`. Ini native browser API,
   tidak nambah dependency. Preview thumbnail ditampilkan dari blob itu.
2. **Submit:** blob hasil kompresi dikirim sebagai bagian `FormData` yang
   sama dengan field teks lainnya (satu form, satu Server Action).
3. **Server Action:** terima file dari `formData.get('photo')`, validasi
   tipe (`image/webp` atau `image/jpeg`/`image/png` untuk browser lama yang
   tidak dukung `toBlob('image/webp')` — fallback otomatis di kode client)
   dan ukuran (maks 4MB setelah kompresi, jauh di bawah limit Vercel).
   Upload ke Storage lewat `getAdminClient().storage.from('katalog')`.
4. Field foto **opsional** di form edit — kalau user tidak pilih file baru,
   `photo_url` lama dipertahankan (tidak upload apa-apa).

### `next.config.ts`

Tambah domain Storage Supabase ke `images.remotePatterns` (pola sama
seperti `sanghyang.com` yang sudah ada) supaya `next/image` (dipakai
`components/photo.tsx`) mau me-render URL publik dari bucket `katalog`.

## Error handling

- Slug tabrakan saat create kategori → auto-suffix angka (lihat atas),
  tidak pernah gagal ke user
- Upload gagal (Storage error, tipe file tidak didukung, kegedean) → pesan
  error di form, field lain (nama/deskripsi/harga) tetap tersimpan kalau
  itu yang gagal cuma bagian foto — atau field foto saja yang di-skip,
  simpan sisanya (foto tetap yang lama)
- Harga bukan angka / negatif → ditolak sebelum submit ke Storage/DB
- Non-owner akses halaman → pesan "khusus pemilik", sama seperti
  `/panel-sanghyang/konten`

## Testing

Manual (sama seperti fitur admin lain di project ini — tidak ada test
otomatis untuk Server Actions dashboard ini):

- Login owner → buka Kelola Katalog → edit nama+foto satu kategori yang
  ada → cek halaman publik kategori itu keupdate
- Tambah kategori baru → cek slug ke-generate benar → cek muncul di
  halaman publik (Home / Fasilitas sesuai `is_bookable`)
- Tambah kategori dengan nama yang menghasilkan slug sama dengan yang
  sudah ada → cek auto-suffix jalan, tidak error
- Tambah item baru di kategori → cek muncul di halaman detail kategori
  publik
- Upload foto besar (>5MB dari HP) → cek terkompres otomatis, tidak gagal
- Login sebagai captain → coba akses `/panel-sanghyang/katalog` → ditolak
