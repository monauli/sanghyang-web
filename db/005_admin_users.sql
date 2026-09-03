-- Fase 6 — tabel admin_users untuk panel admin (/panel-sanghyang).
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Menggantikan Basic Auth hardcode dari versi Express lama
-- (backend/src/middleware/adminAuth.js) dengan akun tersimpan & password
-- ter-hash. Password TIDAK PERNAH disimpan polos — lihat lib/admin/password.ts.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,

  -- Rate limit percobaan login: terkunci sementara setelah beberapa kali
  -- gagal berturut-turut. Direset ke 0/null begitu login berhasil.
  failed_attempts int not null default 0,
  locked_until timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Akun staff untuk panel admin (/panel-sanghyang). Hanya diakses lewat service_role di server — tidak ada GRANT untuk anon/authenticated (default-deny).';

-- Sengaja TIDAK ada RLS policy atau GRANT untuk anon/authenticated: tabel ini
-- hanya boleh disentuh lewat service_role (BYPASSRLS) di server, sama seperti
-- reservation_requests (lihat 003_reservation_requests_revoke_anon.sql).
