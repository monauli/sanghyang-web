-- Fase 4 — RLS + grant untuk public.reservation_requests.
-- BELUM DIJALANKAN. Jalankan setelah 001, di Supabase SQL Editor.
--
-- Dua lapis pertahanan, keduanya perlu (RLS saja tidak cukup, grant saja juga tidak):
--   1. GRANT per-kolom  -> anon secara fisik tidak bisa menyebut kolom id/status/
--                          created_at di INSERT, dan tidak punya SELECT/UPDATE/DELETE.
--   2. RLS policy       -> validasi yang tidak bisa ditulis sebagai CHECK constraint
--                          (butuh current_date & subquery ke tabel lain).

alter table public.reservation_requests enable row level security;

-- Bersihkan dulu supaya bisa dijalankan ulang tanpa efek samping.
revoke all on public.reservation_requests from anon, authenticated;

-- Hanya INSERT, dan hanya kolom-kolom ini. id / status / created_at tidak
-- disebutkan: customer tidak bisa mengirim reservasi yang langsung berstatus
-- 'dikonfirmasi', atau memalsukan created_at.
grant insert (
  customer_name,
  customer_email,
  customer_phone,
  service_id,
  service_item_id,
  reservation_date,
  checkout_date,
  guests,
  notes,
  exely_room_type_id,
  exely_room_name,
  exely_total_price
) on public.reservation_requests to anon;

drop policy if exists "anon kirim permintaan reservasi" on public.reservation_requests;

create policy "anon kirim permintaan reservasi"
  on public.reservation_requests
  for insert
  to anon
  with check (
    -- Redundan dengan grant kolom di atas, tapi murah dan menutup celah kalau
    -- suatu saat grant-nya dilebarkan.
    status = 'baru'

    -- Tanggal masuk akal: tidak di masa lalu, tidak lebih dari setahun ke depan.
    -- Tidak bisa jadi CHECK constraint karena current_date tidak immutable.
    and reservation_date >= current_date
    and reservation_date <= current_date + 365
    and (checkout_date is null or checkout_date <= reservation_date + 30)

    -- Kategorinya memang bisa dipesan. Fasilitas info-only tidak menerima
    -- permintaan reservasi sama sekali.
    and exists (
      select 1 from public.services s
      where s.id = reservation_requests.service_id
        and s.is_bookable
    )

    -- Data kamar Exely hanya masuk akal untuk kategori yang memang lewat Exely.
    and (
      exely_room_type_id is null
      or exists (
        select 1 from public.services s
        where s.id = reservation_requests.service_id
          and s.booking_method = 'exely'
      )
    )

    -- Item harus milik kategori itu dan masih aktif. Ini alasan utama validasi
    -- ini ada di policy, bukan di CHECK: CHECK tidak boleh baca tabel lain.
    and (
      service_item_id is null
      or exists (
        select 1 from public.service_items i
        where i.id = reservation_requests.service_item_id
          and i.service_id = reservation_requests.service_id
          and i.is_active
      )
    )
  );

-- Sengaja TIDAK ada policy SELECT / UPDATE / DELETE.
-- RLS default-deny: tanpa policy, anon (dan authenticated) tidak bisa membaca
-- atau mengubah baris siapa pun, termasuk barisnya sendiri.
-- Staff membacanya lewat service_role (bypass RLS) atau SQL Editor dashboard.
