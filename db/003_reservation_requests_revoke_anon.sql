-- Fase 4 — tutup jalur tulis publik langsung ke reservation_requests.
-- BELUM DIJALANKAN. Jalankan setelah 001 dan 002, di Supabase SQL Editor.
--
-- Kenapa ini perlu: anon key itu publik (ada di HTML setiap halaman). Selama
-- anon punya GRANT INSERT, siapa pun bisa memanggil PostgREST langsung
-- (POST .../rest/v1/reservation_requests dengan anon key sebagai header)
-- dan masuk ke tabel — TANPA pernah lewat Next.js. Honeypot, token anti-bot,
-- dan rate limit di web/lib/antispam.ts semuanya kode Next.js, jadi jalur itu
-- melewatinya sepenuhnya. RLS policy di 002 menjamin *bentuk* barisnya benar,
-- bukan *siapa* yang mengirim atau *seberapa sering*.
--
-- Setelah ini, satu-satunya jalan masuk adalah Server Action kita
-- (app/actions/reservation.ts), yang menulis lewat service_role key —
-- kredensial rahasia yang cuma ada di server, tidak pernah ke browser.

revoke insert (
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
) on public.reservation_requests from anon;

-- Policy INSERT dari 002 sengaja DIBIARKAN, bukan dihapus: service_role
-- (BYPASSRLS) tidak terpengaruh olehnya sama sekali, jadi ia tidak menghalangi
-- Server Action. Tapi kalau suatu saat GRANT INSERT untuk anon tidak sengaja
-- dipulihkan, policy ini tetap jadi lapisan kedua yang menahan baris yang
-- bentuknya salah.
--
-- Verifikasi setelah menjalankan ini:
--   select has_table_privilege('anon', 'public.reservation_requests', 'INSERT');
-- Harus mengembalikan `false`.
