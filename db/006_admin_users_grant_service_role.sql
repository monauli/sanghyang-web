-- Fase 6 — grant privilege ke service_role untuk admin_users.
--
-- Kenapa ini perlu: sama seperti reservation_requests (lihat
-- 004_reservation_requests_grant_service_role.sql), privilege default untuk
-- `service_role` ternyata tidak ter-apply otomatis di project ini. Tanpa
-- grant ini, requireAdminSession/Server Action login (lib/admin, app/actions
-- /admin-auth.ts) yang membaca/menulis admin_users lewat service_role key
-- akan gagal dengan "permission denied for table admin_users".
-- BYPASSRLS pada service_role hanya melewati RLS policy, bukan GRANT tabel —
-- keduanya lapisan terpisah, jadi grant tetap wajib ada meski 005 sengaja
-- tidak memberi GRANT ke anon/authenticated.
--
-- service_role sudah tepercaya penuh di server (lihat komentar di
-- lib/supabase/admin.ts), jadi tidak perlu grant per-kolom.

grant select, insert, update, delete on public.admin_users to service_role;

-- Sudah dijalankan & diverifikasi secara manual di Supabase SQL Editor:
--   select has_table_privilege('service_role', 'public.admin_users', 'SELECT');
-- Hasil: true. File ini menambahkan itu ke riwayat migration.
