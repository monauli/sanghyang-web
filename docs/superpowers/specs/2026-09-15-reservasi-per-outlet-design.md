# Reservasi per Outlet — Fase 6 Checkpoint 2

Status: disetujui, siap dibuat rencana implementasi.

## Konteks & tujuan

Web publik sudah bisa menerima permintaan reservasi (Fase 4), dan panel admin
sudah punya sistem login (Fase 6 Checkpoint 1). Yang belum ada: reservasi yang
masuk tidak memberi tahu siapa pun, dan `/panel-sanghyang` masih halaman
placeholder tanpa isi.

Checkpoint ini menyambungkan keduanya untuk 5 outlet resort:

1. Tiap outlet punya link sendiri, dipasang sebagai barcode di lapangan. Tamu
   scan, form reservasi langsung terbuka dengan outlet sudah terisi.
2. Reservasi yang masuk mengirim notifikasi email ke captain outlet yang
   bersangkutan.
3. Captain login ke dashboard dan hanya melihat reservasi outletnya sendiri.
   Pemilik melihat semuanya.

Outlet yang tercakup: D'Bistro, Sunset Grill, D'Spa, D'Bar & Karaoke, dan
Dragon Beach Club — lima outlet dengan `booking_method = 'self_service'`.

Rooms **tidak** termasuk. Booking kamar tetap diarahkan ke halaman booking
Exely seperti sekarang, dan notifikasinya sudah ditangani Exely/OTA. Datanya
tidak pernah masuk database kita, jadi tidak ada yang perlu ditampilkan atau
dinotifikasi.

## Keputusan desain (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Struktur outlet | Tabel `outlets` baru, relasi 1:1 ke `services` | `services` adalah katalog yang dibaca tamu. Email captain dan pengaturan notifikasi bukan urusan tamu, jadi dipisah. |
| Sistem login | Tetap yang sudah ada (scrypt + `jose`) | Alternatifnya pindah ke Supabase Auth demi RLS, tapi itu membuang seluruh Checkpoint 1 tanpa perubahan apa pun yang terlihat pengguna. Untuk 5 outlet tetap, tidak sepadan. |
| Pemisahan data antar outlet | Ditegakkan di kode server, bukan RLS | Panel admin mengakses database lewat `service_role` yang memang menembus RLS (`lib/supabase/admin.ts`), jadi policy database tidak akan menolong di jalur ini. Gantinya: satu fungsi pembungkus yang wajib dilewati semua query admin. |
| Kanal notifikasi | Email lewat SMTP Gmail | Gratis, batas ~500 email/hari (jauh di atas kebutuhan), dan captain tidak perlu memasang aplikasi baru. WhatsApp wajib gateway berbayar; Telegram gratis tapi captain harus memasang Telegram. |
| Bentuk pengirim notifikasi | Satu modul dengan antarmuka tunggal | Supaya penggantian kanal (Telegram, gateway WA) hanya menyentuh satu file. |
| Waktu kirim notifikasi | Setelah respons dikirim ke tamu (`after()` dari `next/server`) | Tamu tidak menunggu SMTP. Kegagalan kirim tidak boleh menggagalkan reservasi yang sudah tersimpan. |
| Isi email | Data tamu lengkap + tombol chat WhatsApp + tombol dashboard | Captain bisa langsung menghubungi tamu tanpa login. Tombol WhatsApp menutup kelemahan email yang tidak bisa mengirim WA otomatis — yang mengirim tetap captain, manual, satu klik. |
| Barcode | Di luar lingkup. Sistem hanya menyediakan 5 link | Pembuatan dan pencetakan barcode dikerjakan orang lapangan dari link yang disediakan. |
| Bentuk link outlet | Halaman kategori yang sudah ada + parameter `?reservasi=1` | Tidak perlu halaman baru. Satu halaman untuk lima outlet berarti pekerjaan redesign nanti cukup sekali. |
| Tampilan dashboard | Fungsional seperlunya | Polish visual masuk ke pekerjaan redesign terpisah, supaya tidak dikerjakan dua kali. |

Dependency baru: **`nodemailer`** saja.

## Skema database

Pola sama seperti migrasi sebelumnya: file SQL **ditulis, tidak dijalankan**.
User yang menjalankannya manual di Supabase SQL Editor setelah review.

### `db/007_outlets.sql`

```sql
create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),

  -- 1:1 ke services. unique supaya satu kategori tidak bisa punya dua outlet.
  service_id uuid not null unique references public.services(id),

  name text not null check (length(btrim(name)) between 2 and 100),

  -- Tujuan notifikasi. Boleh null: outlet yang belum diisi emailnya tetap
  -- menerima reservasi, hanya tidak mengirim notifikasi (dicatat di log).
  notify_email text
    check (notify_email is null
           or notify_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'),

  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

Tidak ada GRANT untuk `anon`/`authenticated` — sama seperti `admin_users` dan
`reservation_requests`, tabel ini hanya disentuh lewat `service_role` di server.
Butuh `GRANT ... TO service_role` eksplisit; di project Supabase ini
`service_role` tidak otomatis mendapat privilege tabel baru.

Kolom `qr_code` sengaja tidak ada. Barcode di luar lingkup, dan link outlet
sudah bisa dibentuk dari `services.type` (slug) yang ada.

### `db/008_admin_users_outlet.sql`

```sql
alter table public.admin_users
  add column if not exists outlet_id uuid references public.outlets(id);
```

`outlet_id` null berarti akun pemilik: melihat semua outlet dan boleh mengelola
katalog, konten, serta akun captain. `outlet_id` terisi berarti akun captain:
hanya outlet tersebut.

`reservation_requests` tidak diubah. Kolom `service_id` yang sudah ada cukup
untuk menentukan reservasi milik outlet mana, lewat join ke `outlets`.

## Alur reservasi & notifikasi

```
Tamu scan barcode outlet
  -> /kategori/<slug>?reservasi=1   (form terbuka otomatis, outlet terisi)
  -> submit
  -> submitReservation (Server Action yang sudah ada)
       1. anti-spam: honeypot + token + rate limit        [sudah ada]
       2. validasi server                                  [sudah ada]
       3. insert ke reservation_requests                    [sudah ada]
       4. redirect ke /reservasi/terkirim                   [sudah ada]
       5. after(): kirim notifikasi                         [BARU]
```

Langkah 5 berjalan setelah respons dikirim, jadi tamu tidak menunggu SMTP.

Kegagalan pada langkah 5 tidak boleh mengubah hasil langkah 1-4: reservasi
sudah tersimpan, tamu sudah melihat halaman terkirim. Kegagalan dicatat ke log
server dengan id reservasi supaya bisa dilacak dan ditindaklanjuti manual.

Tujuan email diambil dari `outlets.notify_email` milik `service_id` reservasi
tersebut. Kalau kosong atau outletnya tidak aktif, notifikasi dilewati dan
dicatat di log.

### Isi email

- Subjek memuat nama outlet dan tanggal reservasi, supaya terbaca dari daftar
  inbox tanpa perlu dibuka
- Badan: nama, telepon, email, tanggal (dan check-out bila ada), jumlah tamu,
  pilihan item, catatan tamu
- Tombol **Chat via WhatsApp** — `https://wa.me/<telepon tamu>` dengan pesan
  sapaan yang sudah terisi. Nomor telepon dinormalkan ke format internasional
  (`08xx` menjadi `628xx`); nomor yang tidak bisa dinormalkan membuat tombolnya
  tidak ditampilkan, bukan menghasilkan link rusak
- Tombol **Buka dashboard** — ke daftar reservasi outlet tersebut

## Hak akses dashboard

### Sesi

Payload sesi (`lib/admin/session.ts`) ditambah dua field: `outletId` (string
atau null) dan `role` (`owner` atau `captain`). Keduanya diisi saat login dari
baris `admin_users`.

Konsekuensi: sesi yang sudah berjalan tidak memuat field baru ini. Sesi tanpa
`role` diperlakukan sebagai tidak sah dan diarahkan ke halaman login — durasi
sesi hanya 8 jam, jadi dampaknya paling lama satu kali login ulang.

### Penegakan pemisahan data

Semua query dashboard wajib lewat satu fungsi pembungkus yang mengambil
`outletId` dari sesi dan menempelkannya sebagai filter. Tidak ada satu pun
Server Action atau Route Handler admin yang memanggil `getAdminClient()`
langsung untuk data reservasi.

Captain yang mengubah URL, parameter, atau id di request tidak bisa menjangkau
outlet lain, karena filter tidak berasal dari request melainkan dari sesi.

### Yang bisa diakses

| Kemampuan | Pemilik | Captain |
|---|---|---|
| Lihat reservasi | Semua outlet, bisa disaring | Outletnya saja |
| Ubah status reservasi | Ya | Outletnya saja |
| Tombol chat WhatsApp tamu | Ya | Ya |
| Ubah `notify_email` | Semua outlet | Outletnya saja |
| Lihat & salin 5 link outlet | Ya | Tidak |
| Kelola akun captain | Ya | Tidak |
| Kelola katalog & konten web | Ya | Tidak |

Status reservasi memakai nilai yang sudah ada di CHECK constraint
`reservation_requests`: `baru`, `dihubungi`, `dikonfirmasi`, `batal`.

Pengelolaan katalog dan konten web sudah tercatat sebagai bagian Fase 6B di
`CLAUDE.md`. Checkpoint ini hanya menyiapkan pembedaan hak aksesnya; fiturnya
sendiri menyusul terpisah.

## Pembagian modul

| Modul | Tanggung jawab | Bergantung pada |
|---|---|---|
| `lib/outlets.ts` | Baca data outlet, petakan `service_id` ke outlet | Supabase admin client |
| `lib/notify/mailer.ts` | Kirim email lewat SMTP Gmail | `nodemailer`, env SMTP |
| `lib/notify/reservation-notice.ts` | Susun subjek & badan email dari satu reservasi | `lib/outlets.ts`, mailer |
| `lib/admin/scope.ts` | Pembungkus query admin yang menempelkan filter outlet | Sesi admin, Supabase admin client |
| `app/panel-sanghyang/reservasi/` | Halaman daftar reservasi + ubah status | `lib/admin/scope.ts` |

Pemisahan `mailer.ts` (cara mengirim) dari `reservation-notice.ts` (apa yang
dikirim) adalah yang membuat penggantian kanal notifikasi nanti murah: ganti
kanal berarti mengganti `mailer.ts` saja.

## Env var baru

Diisi sendiri oleh user di `.env.local` dan di Vercel Production. Tidak ada
yang boleh berprefix `NEXT_PUBLIC_`.

```
SMTP_USER=          # alamat Gmail resort yang jadi pengirim
SMTP_PASSWORD=      # App Password 16 karakter, bukan password Gmail
```

App Password mensyaratkan verifikasi 2 langkah aktif di akun Gmail tersebut.
Kalau salah satu env kosong, notifikasi dilewati dan dicatat di log — sisa
sistem tetap berjalan.

## Penanganan error

| Kondisi | Perilaku |
|---|---|
| SMTP gagal / timeout | Reservasi tetap tersimpan, tamu tetap melihat halaman terkirim, kegagalan dicatat dengan id reservasi |
| `notify_email` kosong | Notifikasi dilewati, dicatat di log |
| Env SMTP kosong | Notifikasi dilewati, dicatat di log |
| Outlet tidak ditemukan untuk `service_id` | Notifikasi dilewati, dicatat sebagai peringatan (kemungkinan data outlet belum dilengkapi) |
| Nomor telepon tamu tidak bisa dinormalkan | Tombol WhatsApp tidak ditampilkan, email tetap terkirim |
| Sesi tanpa `role`/`outletId` | Diarahkan ke halaman login |

Pola umumnya: notifikasi adalah lapisan tambahan yang tidak boleh pernah
menggagalkan reservasi.

## Rencana pengujian

Pola sama seperti yang sudah ada: `node --test` atas `scripts/*.test.ts`, tanpa
framework.

1. **Pemisahan data antar outlet** — captain Bistro meminta reservasi DBC harus
   mengembalikan kosong, baik lewat daftar maupun lewat id langsung. Ini test
   terpenting di checkpoint ini.
2. **Ubah status lintas outlet** — captain Bistro mengubah status reservasi DBC
   harus ditolak.
3. **Pemilik melihat semua** — akun `outlet_id` null mendapat reservasi dari
   semua outlet.
4. **Penyusunan email** — subjek dan badan memuat data yang benar; link
   `wa.me` memakai nomor yang sudah dinormalkan.
5. **Normalisasi nomor telepon** — `0812...`, `+62812...`, `62812...`, dan
   nomor tidak valid.
6. **Kegagalan notifikasi tidak menggagalkan reservasi** — mailer yang melempar
   error tidak mengubah hasil `submitReservation`.

Pengiriman email sungguhan tidak ikut di test otomatis; diverifikasi manual
sekali setelah env SMTP diisi.

## Di luar lingkup

- Pembuatan dan pencetakan barcode
- Notifikasi WhatsApp atau Telegram (desain sudah menyiapkan jalannya, tapi
  tidak dibangun sekarang)
- Kelola katalog, harga, foto, dan konten web (Fase 6B, terpisah)
- Impor file Excel Exely
- Polish visual dashboard dan halaman publik (pekerjaan redesign, terpisah)
- Domain sendiri. Selama masih memakai alamat `vercel.app`, barcode yang sudah
  dicetak akan mati bila domain diganti — beli domain dulu sebelum mencetak
  barcode dalam jumlah banyak.
