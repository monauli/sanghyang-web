-- Fase 6B — reset password self-service untuk admin_users.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Token TIDAK PERNAH disimpan polos — token_hash pakai format yang sama
-- dengan admin_users.password_hash (scrypt:<salt>:<hash>), lihat
-- lib/admin/password-reset.ts.

create table if not exists public.admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.admin_password_resets is
  'Token reset password admin panel. Token asli cuma ada di email, DB cuma nyimpan hash-nya. Hanya diakses lewat service_role di server.';

-- Sengaja TIDAK ada RLS/GRANT untuk anon/authenticated: default-deny sama
-- seperti admin_users.
grant select, insert, update on public.admin_password_resets to service_role;
