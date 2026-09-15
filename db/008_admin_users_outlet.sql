-- Fase 6 Checkpoint 2 — hubungkan akun admin ke outlet.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- outlet_id null  = akun pemilik: lihat semua outlet, kelola katalog & akun.
-- outlet_id terisi = akun captain: hanya outlet tersebut.

alter table public.admin_users
  add column if not exists outlet_id uuid references public.outlets(id);

comment on column public.admin_users.outlet_id is
  'null = pemilik (lihat semua). Terisi = captain outlet tersebut.';
