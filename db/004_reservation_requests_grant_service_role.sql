-- Fase 4 — grant privilege ke service_role untuk reservation_requests.
--
-- Kenapa ini perlu: migrasi 002 hanya `revoke all ... from anon, authenticated`
-- dan `grant insert (kolom...) ... to anon`. Privilege default untuk
-- `service_role` ternyata tidak ter-apply otomatis di project ini, jadi
-- Server Action di app/actions/reservation.ts (yang menulis lewat
-- lib/supabase/admin.ts, service_role key) gagal dengan:
--   "permission denied for table reservation_requests"
-- BYPASSRLS pada service_role hanya melewati RLS policy, bukan GRANT tabel —
-- keduanya lapisan terpisah, jadi grant tetap wajib ada.
--
-- service_role sudah tepercaya penuh di server (lihat komentar di
-- lib/supabase/admin.ts), jadi tidak perlu grant per-kolom seperti anon di 002.

grant select, insert, update, delete on public.reservation_requests to service_role;
