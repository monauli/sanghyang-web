-- Fase 6 Checkpoint 2 — grant privilege ke service_role untuk services.
-- BELUM DIJALANKAN. Review dulu, lalu paste ke Supabase SQL Editor.
--
-- Ketahuan pas testing: lib/outlets.ts (panel admin) join outlets -> services
-- lewat service_role untuk ambil slug kategori. service_role sebelumnya tidak
-- pernah butuh baca services langsung (baca publik selalu lewat anon key di
-- lib/supabase/public.ts), jadi belum ada GRANT — sama seperti pola di
-- 004/006/007, privilege default untuk service_role bukan "semua tabel".
--
-- select-only: panel admin cuma baca services, tidak pernah mengubahnya dari
-- jalur ini.

grant select on public.services to service_role;
