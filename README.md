# Sanghyang Resort — Website Publik

Website publik Sanghyang Resort (Next.js 16 App Router). Menampilkan kamar,
dining, spa, dan aktivitas keluarga di Anyer, dengan form permintaan reservasi
tanpa login — pengunjung mengirim permintaan, tim resort menghubungi untuk
konfirmasi. Belum ada pembayaran di tahap ini.

Untuk kategori kamar ("Rooms"), ketersediaan & harga diambil real-time dari
Exely. Kategori lain pakai form self-service biasa.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Sebelum menjalankan,
salin `.env.example` ke `.env.local` dan isi semua variabel di bawah.

## Environment variables

Didefinisikan di `.env.example` (nilai kosong, isi sendiri di `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — rahasia, server-only
- `EXELY_CLIENT_ID`
- `EXELY_CLIENT_SECRET`
- `EXELY_PROPERTY_ID`
- `NEXT_PUBLIC_SITE_URL`
- `RESERVATION_FORM_SECRET` — opsional
- `ADMIN_SESSION_SECRET` — rahasia, server-only, untuk sesi login panel admin

`.env.local` tidak pernah di-commit (lihat `.gitignore`).

## Struktur folder

```
app/              Route App Router (halaman publik, Server Actions, Route Handlers)
  actions/        Server Actions (submit form reservasi)
  api/            Route Handlers (mis. proxy ketersediaan kamar Exely)
components/       Komponen React (UI shadcn di components/ui)
lib/              Validasi form, anti-spam, klien Supabase, integrasi Exely
db/               Migrasi SQL untuk tabel reservation_requests (jalankan manual
                  di Supabase SQL Editor, urut sesuai nomor)
scripts/          Test unit untuk lib/ (node --test)
```

## Database

Tabel `reservation_requests` dan proteksinya didefinisikan lewat migrasi di
`db/001` s.d. `db/004`, dijalankan manual lewat Supabase SQL Editor secara
berurutan. File-file ini tidak berisi rahasia — aman untuk di-commit.
