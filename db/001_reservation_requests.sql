-- Fase 4 — permintaan reservasi dari web publik (tanpa login).
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Sengaja tidak memakai tabel `bookings`: bookings.user_id NOT NULL REFERENCES
-- users(id), sementara web ini tanpa login. Ini tabel terpisah untuk "lead",
-- bukan booking yang sudah pasti.

create table if not exists public.reservation_requests (
  id uuid primary key default gen_random_uuid(),

  -- Data customer
  customer_name text not null
    check (length(btrim(customer_name)) between 2 and 100),
  customer_email text not null
    check (customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'
           and length(customer_email) <= 160),
  -- Longgar: +62, 08xx, spasi/strip. Ketat soal panjang & karakter saja.
  customer_phone text not null
    check (customer_phone ~ '^\+?[0-9][0-9 .-]{7,19}$'),

  -- Apa yang diminta
  service_id uuid not null references public.services(id),
  service_item_id uuid references public.service_items(id),

  reservation_date date not null,
  checkout_date date,                                   -- hanya untuk menginap
  guests int not null check (guests between 1 and 50),
  notes text check (notes is null or length(notes) <= 1000),

  -- Snapshot pilihan kamar dari Exely (kategori rooms). Disimpan sebagai teks
  -- apa adanya: ini catatan untuk staff, bukan foreign key ke sistem Exely.
  exely_room_type_id text check (exely_room_type_id is null or length(exely_room_type_id) <= 64),
  exely_room_name text check (exely_room_name is null or length(exely_room_name) <= 200),
  exely_total_price numeric(12,2) check (exely_total_price is null or exely_total_price >= 0),

  status text not null default 'baru'
    check (status in ('baru', 'dihubungi', 'dikonfirmasi', 'batal')),
  created_at timestamptz not null default now(),

  constraint reservation_requests_checkout_after_checkin
    check (checkout_date is null or checkout_date > reservation_date)
);

comment on table public.reservation_requests is
  'Permintaan reservasi dari web publik. Belum terkonfirmasi, belum ada pembayaran.';
