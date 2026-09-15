-- Fase 6 Checkpoint 2 — outlet yang menerima reservasi dari web/barcode.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Dipisah dari `services` dengan sengaja: `services` adalah katalog yang
-- dibaca tamu (role anon). Email captain dan pengaturan notifikasi bukan
-- urusan tamu, jadi tidak boleh ikut terbaca dari halaman publik.

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),

  -- 1:1 ke services. unique supaya satu kategori tidak bisa punya dua outlet.
  service_id uuid not null unique references public.services(id),

  name text not null check (length(btrim(name)) between 2 and 100),

  -- Tujuan notifikasi. Boleh null: outlet yang emailnya belum diisi tetap
  -- menerima reservasi, hanya tidak mengirim notifikasi (dicatat di log).
  notify_email text
    check (notify_email is null
           or notify_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'),

  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.outlets is
  'Outlet self-service yang menerima reservasi dari web. Hanya diakses lewat service_role di server.';

-- Sengaja TIDAK ada GRANT untuk anon/authenticated (default-deny).
-- service_role di project ini tidak otomatis dapat privilege tabel baru.
grant select, insert, update, delete on public.outlets to service_role;
